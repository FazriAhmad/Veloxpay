// End-to-end HTTP test of the main payroll flow, driven through the real Express
// app (no server process, no mocks) via supertest: register -> add employee ->
// generate slip -> approve -> mark paid -> RBAC checks. Needs a real DATABASE_URL
// (server/.env) since this exercises real SQL, not a stand-in.
//
// Note: this intentionally never deletes the company it creates. audit_logs rows
// are permanent by design (see schema.sql's immutability rules), so deleting the
// company would only orphan its audit trail rather than actually clean anything up
// — leaving a handful of unused test companies behind is the honest tradeoff.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { app } from '../app.js';
import { pool } from '../db.js';

const request = supertest(app);
const unique = randomUUID().slice(0, 8);

let adminToken;
let employeeToken;
let employeeId;
let slipId;

test('register creates a company and its first admin', async () => {
  const res = await request.post('/auth/register').send({
    companyName: `Test Co ${unique}`,
    name: 'Test Admin',
    email: `admin-${unique}@test.local`,
    password: 'testpassword123',
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.role, 'admin');
  adminToken = res.body.token;
});

test('an unauthenticated request is rejected', async () => {
  const res = await request.get('/employees');
  assert.equal(res.status, 401);
});

test('admin creates an employee', async () => {
  const res = await request
    .post('/employees')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Test Employee',
      email: `emp-${unique}@test.local`,
      role: 'QA Engineer',
      department: 'Engineering',
      baseSalary: 10_000_000,
      bankName: 'BCA',
      bankAccount: '1234567890',
    });
  assert.equal(res.status, 201);
  employeeId = res.body.id;
});

test('admin creates a login for that employee, and it authenticates', async () => {
  const res = await request
    .post('/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ employeeId, email: `emplogin-${unique}@test.local`, password: 'employeepass123' });
  assert.equal(res.status, 201);

  const login = await request
    .post('/auth/login')
    .send({ email: `emplogin-${unique}@test.local`, password: 'employeepass123' });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'employee');
  employeeToken = login.body.token;
});

test('employee role cannot create another employee (RBAC enforced server-side)', async () => {
  const res = await request
    .post('/employees')
    .set('Authorization', `Bearer ${employeeToken}`)
    .send({ name: 'Should Not Exist', role: 'x', department: 'x', baseSalary: 1 });
  assert.equal(res.status, 403);
});

test('employee sees only their own employee record', async () => {
  const res = await request.get('/employees').set('Authorization', `Bearer ${employeeToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].id, employeeId);
});

test('admin generates a payroll slip with PPh 21 and BPJS computed server-side', async () => {
  const res = await request
    .post('/slips')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      employeeId,
      employeeName: 'Test Employee',
      employeeRole: 'QA Engineer',
      employeeDepartment: 'Engineering',
      month: '2026-09',
      baseSalary: 10_000_000,
      bankName: 'BCA',
      bankAccount: '1234567890',
      allowances: [],
      deductions: [],
    });
  assert.equal(res.status, 201);
  slipId = res.body.id;
  const deductionNames = res.body.deductions.map((d) => d.name);
  assert.ok(deductionNames.some((n) => n.includes('BPJS Kesehatan')));
  assert.ok(res.body.netSalary < res.body.grossSalary);
});

test('a duplicate slip for the same employee and month is rejected', async () => {
  const res = await request
    .post('/slips')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ employeeId, month: '2026-09', baseSalary: 10_000_000 });
  assert.equal(res.status, 409);
});

test('approve then mark paid, which logs a notification attempt', async () => {
  const approve = await request
    .patch(`/slips/${slipId}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'Approved' });
  assert.equal(approve.status, 200);

  const paid = await request
    .patch(`/slips/${slipId}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'Paid' });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.status, 'Paid');

  const notifs = await request.get('/notifications').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(notifs.status, 200);
  assert.ok(notifs.body.some((n) => n.slipId === slipId));
});

test('the PDF endpoint returns a real PDF for the slip', async () => {
  const res = await request.get(`/slips/${slipId}/pdf`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'application/pdf');
  assert.equal(res.body.subarray(0, 5).toString('ascii'), '%PDF-');
});

// --- Slip integrity ---------------------------------------------------------
// These pin down the four problems a review of routes/slips.js found: money fields
// taken from the request, unvalidated amounts, an unconstrained status flow, and
// slip identity (colliding ids, no database-level uniqueness).

const postSlip = (body) => request.post('/slips').set('Authorization', `Bearer ${adminToken}`).send(body);
const patchStatus = (id, status) =>
  request.patch(`/slips/${id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status });
const notificationsFor = async (id) =>
  (await request.get('/notifications').set('Authorization', `Bearer ${adminToken}`)).body.filter((n) => n.slipId === id && n.kind === 'payslip_paid');

let tamperSlipId;

test('a slip takes salary, name and bank account from the employee record, not the request', async () => {
  const res = await postSlip({
    employeeId,
    month: '2026-10',
    // Everything below is a lie the client should not be able to tell:
    employeeName: 'Somebody Else',
    employeeRole: 'CEO',
    baseSalary: 99,
    bankName: 'EvilBank',
    bankAccount: 'ATTACKER-ACCOUNT-1',
    overtimePay: 9_999_999,
    overtimeHours: 10,
  });
  assert.equal(res.status, 201);
  tamperSlipId = res.body.id;
  assert.equal(res.body.baseSalary, 10_000_000);
  assert.equal(res.body.employeeName, 'Test Employee');
  assert.equal(res.body.employeeRole, 'QA Engineer');
  assert.equal(res.body.bankName, 'BCA');
  assert.equal(res.body.bankAccount, '1234567890');
  // Overtime pay is derived from the stored salary and the hours, not the claimed figure.
  assert.equal(res.body.overtimePay, Math.round(10 * (10_000_000 / 173) * 1.5));
  assert.equal(res.body.overtimeHours, 10);
});

test('the bank account on a slip is still encrypted at rest', async () => {
  const row = await pool.query('SELECT bank_account FROM payroll_slips WHERE id = $1', [tamperSlipId]);
  assert.match(row.rows[0].bank_account, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  assert.ok(!row.rows[0].bank_account.includes('1234567890'));
});

test('an employee outside the company cannot be used to issue a slip', async () => {
  const res = await postSlip({ employeeId: 'EMP-NOPE00', month: '2026-11' });
  assert.equal(res.status, 404);
});

test('non-numeric, negative and blank amounts are rejected, and no slip is created', async () => {
  const bad = [
    { allowances: [{ name: 'Transport', amount: 'abc' }] },
    { allowances: [{ name: 'Transport', amount: -500_000 }] },
    { allowances: [{ name: 'Transport', amount: '' }] },
    { allowances: [{ name: 'Transport', amount: null }] },
    { allowances: [{ amount: 1000 }] },
    { deductions: [{ name: 'Loan', amount: 'NaN' }] },
    { allowances: 'not a list' },
    { overtimeHours: 'lots' },
    { overtimeHours: -3 },
    { overtimeHours: 10_000 },
  ];
  for (const extra of bad) {
    // baseSalary is sent (and ignored) so a refusal here is about the amounts, not a missing field.
    const res = await postSlip({ employeeId, month: '2026-11', baseSalary: 10_000_000, ...extra });
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(extra)}, got ${res.status}`);
  }
  const slips = await request.get('/slips').set('Authorization', `Bearer ${adminToken}`);
  assert.ok(!slips.body.some((s) => s.month === '2026-11'), 'a rejected request must not leave a slip behind');
});

test('deductions larger than earnings are refused rather than producing negative take-home pay', async () => {
  const res = await postSlip({ employeeId, month: '2026-11', baseSalary: 10_000_000, deductions: [{ name: 'Huge loan', amount: 50_000_000 }] });
  assert.equal(res.status, 400);
});

test('the month must be a real YYYY-MM', async () => {
  for (const month of ['2026-13', '2026-9', 'september', '', 202609, null]) {
    const res = await postSlip({ employeeId, month, baseSalary: 10_000_000 });
    assert.equal(res.status, 400, `month ${JSON.stringify(month)} should be refused`);
  }
});

test('valid allowances and deductions are stored cleaned down to name and amount', async () => {
  const res = await postSlip({
    employeeId,
    month: '2026-12',
    allowances: [{ name: '  Transport ', amount: '300000', injected: '<script>' }],
    deductions: [{ name: 'Koperasi', amount: 100_000 }],
  });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.allowances, [{ name: 'Transport', amount: 300_000 }]);
  assert.ok(res.body.deductions.some((d) => d.name === 'Koperasi' && d.amount === 100_000));
  assert.equal(res.body.grossSalary, 10_300_000);
});

test('slip ids carry an 8-character suffix, so they do not collide at realistic sizes', () => {
  assert.match(tamperSlipId, /^PAY-202610-[0-9A-F]{8}$/);
});

test('two simultaneous requests for the same employee and month yield exactly one slip', async () => {
  const [a, b] = await Promise.all([
    postSlip({ employeeId, month: '2027-01' }),
    postSlip({ employeeId, month: '2027-01' }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  const count = await pool.query(
    'SELECT count(*)::int AS n FROM payroll_slips WHERE employee_id = $1 AND month = $2',
    [employeeId, '2027-01']
  );
  assert.equal(count.rows[0].n, 1);
});

test('a slip cannot skip approval or leave the Paid state', async () => {
  const skip = await patchStatus(tamperSlipId, 'Paid');
  assert.equal(skip.status, 409, 'Draft -> Paid must be refused');

  const unknown = await patchStatus(tamperSlipId, 'Cancelled');
  assert.equal(unknown.status, 400);

  assert.equal((await patchStatus(tamperSlipId, 'Approved')).status, 200);
});

test('paying a slip twice at once sends exactly one notification', async () => {
  const [a, b] = await Promise.all([patchStatus(tamperSlipId, 'Paid'), patchStatus(tamperSlipId, 'Paid')]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal((await notificationsFor(tamperSlipId)).length, 1);
});

test('a paid slip is final: no repeat, no reversal, no second email', async () => {
  const before = (await notificationsFor(tamperSlipId)).length;
  for (const to of ['Paid', 'Draft', 'Approved', 'Pending Approval']) {
    const res = await patchStatus(tamperSlipId, to);
    assert.equal(res.status, 409, `Paid -> ${to} must be refused`);
  }
  assert.equal((await notificationsFor(tamperSlipId)).length, before);
});

test('an approved or paid slip cannot be deleted, and is still there afterwards', async () => {
  const res = await request.delete(`/slips/${tamperSlipId}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 409);
  const slips = await request.get('/slips').set('Authorization', `Bearer ${adminToken}`);
  assert.ok(slips.body.some((s) => s.id === tamperSlipId));
});

test('a draft can be deleted, and deleting it again reports not found', async () => {
  const draft = await postSlip({ employeeId, month: '2027-02' });
  assert.equal(draft.status, 201);
  const first = await request.delete(`/slips/${draft.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(first.status, 204);
  const again = await request.delete(`/slips/${draft.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(again.status, 404);
});

test('withdrawing an approval returns the slip to Draft and clears who approved it', async () => {
  const draft = await postSlip({ employeeId, month: '2027-03' });
  assert.equal((await patchStatus(draft.body.id, 'Approved')).body.approvedBy, 'Test Admin');
  const back = await patchStatus(draft.body.id, 'Draft');
  assert.equal(back.status, 200);
  assert.equal(back.body.status, 'Draft');
  assert.equal(back.body.approvedBy, undefined);
});

const putEmployee = (id, over) =>
  request.put(`/employees/${id}`).set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Edited', role: 'QA', department: 'Eng', baseSalary: 10_000_000, ...over });

test('employee salary must be a finite number above zero, on create and on edit', async () => {
  const bad = ['NaN', 'Infinity', -5, 0, 'abc', null, '', 1e12];
  for (const baseSalary of bad) {
    const res = await putEmployee(employeeId, { baseSalary });
    assert.equal(res.status, 400, `PUT baseSalary=${JSON.stringify(baseSalary)}`);
    const create = await request.post('/employees').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X', role: 'QA', department: 'Eng', baseSalary });
    assert.equal(create.status, 400, `POST baseSalary=${JSON.stringify(baseSalary)}`);
  }
  const ok = await putEmployee(employeeId, { baseSalary: '10000000' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.baseSalary, 10_000_000);
});

test('a slip is refused when the stored salary is corrupt', async () => {
  const emp = await request.post('/employees').set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Corrupt', role: 'QA', department: 'Eng', baseSalary: 5_000_000 });
  await pool.query(`UPDATE employees SET base_salary = 'NaN' WHERE id = $1`, [emp.body.id]);
  const res = await postSlip({ employeeId: emp.body.id, month: '2027-08' });
  assert.equal(res.status, 422);
});

test('an employee with an Approved or Paid slip cannot be deleted; one with only drafts can', async () => {
  const mk = async (name) => (await request.post('/employees').set('Authorization', `Bearer ${adminToken}`)
    .send({ name, role: 'QA', department: 'Eng', baseSalary: 8_000_000 })).body.id;

  const paidEmp = await mk('Has Paid');
  const slip = await postSlip({ employeeId: paidEmp, month: '2027-09' });
  await patchStatus(slip.body.id, 'Approved');
  await patchStatus(slip.body.id, 'Paid');
  const blocked = await request.delete(`/employees/${paidEmp}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(blocked.status, 409);
  const slips = await request.get('/slips').set('Authorization', `Bearer ${adminToken}`);
  assert.ok(slips.body.some((s) => s.id === slip.body.id && s.status === 'Paid'));

  const draftEmp = await mk('Has Draft');
  await postSlip({ employeeId: draftEmp, month: '2027-09' });
  assert.equal((await request.delete(`/employees/${draftEmp}`).set('Authorization', `Bearer ${adminToken}`)).status, 204);
  assert.equal((await request.delete(`/employees/${draftEmp}`).set('Authorization', `Bearer ${adminToken}`)).status, 404);
});

// ---- maker-checker roles ------------------------------------------------------------
const as = (token) => (r) => r.set('Authorization', `Bearer ${token}`);
const mkStaff = async (role) => {
  const email = `${role}-${unique}-${Math.random().toString(16).slice(2, 6)}@test.local`;
  const created = await request.post('/users').set('Authorization', `Bearer ${adminToken}`)
    .send({ role, name: `Test ${role}`, email, password: 'staffpass123' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const login = await request.post('/auth/login').send({ email, password: 'staffpass123' });
  assert.equal(login.body.user.role, role);
  return login.body.token;
};
const setSeparate = (on) =>
  request.put('/settings').set('Authorization', `Bearer ${adminToken}`).send({ requireSeparateApprover: on });
const patchAs = (token, id, status) =>
  request.patch(`/slips/${id}/status`).set('Authorization', `Bearer ${token}`).send({ status });

test('only admin can create staff logins, and only for known roles', async () => {
  const finance = await mkStaff('finance');
  const res = await request.post('/users').set('Authorization', `Bearer ${finance}`)
    .send({ role: 'approver', name: 'x', email: `x-${unique}@test.local`, password: 'staffpass123' });
  assert.equal(res.status, 403);
  const bad = await request.post('/users').set('Authorization', `Bearer ${adminToken}`)
    .send({ role: 'superuser', name: 'x', email: `y-${unique}@test.local`, password: 'staffpass123' });
  assert.equal(bad.status, 400);
});

test('finance can prepare a slip but cannot approve or pay it', async () => {
  const finance = await mkStaff('finance');
  const slip = await request.post('/slips').set('Authorization', `Bearer ${finance}`).send({ employeeId, month: '2028-01' });
  assert.equal(slip.status, 201);
  assert.equal((await patchAs(finance, slip.body.id, 'Pending Approval')).status, 200);
  assert.equal((await patchAs(finance, slip.body.id, 'Approved')).status, 403);
  assert.notEqual((await patchAs(finance, slip.body.id, 'Paid')).status, 200);
  const stored = (await request.get('/slips').set('Authorization', `Bearer ${adminToken}`)).body.find((s) => s.id === slip.body.id);
  assert.equal(stored.status, 'Pending Approval');
});

test('approver can approve and pay but cannot create slips, edit employees or read the audit log', async () => {
  const finance = await mkStaff('finance');
  const approver = await mkStaff('approver');
  const slip = await request.post('/slips').set('Authorization', `Bearer ${finance}`).send({ employeeId, month: '2028-02' });
  assert.equal((await request.post('/slips').set('Authorization', `Bearer ${approver}`).send({ employeeId, month: '2028-03' })).status, 403);
  assert.equal((await patchAs(approver, slip.body.id, 'Approved')).status, 200);
  assert.equal((await patchAs(approver, slip.body.id, 'Paid')).status, 200);
  assert.equal((await request.put(`/employees/${employeeId}`).set('Authorization', `Bearer ${approver}`)
    .send({ name: 'x', role: 'x', department: 'x', baseSalary: 1 })).status, 403);
  assert.equal((await request.get('/audit-logs').set('Authorization', `Bearer ${approver}`)).status, 403);
});

test('an employee login still cannot touch slip status', async () => {
  const slip = await postSlip({ employeeId, month: '2028-04' });
  assert.equal((await patchAs(employeeToken, slip.body.id, 'Approved')).status, 403);
});

test('with the setting on, the creator cannot approve their own slip; another approver can', async () => {
  assert.equal((await setSeparate(true)).status, 200);
  try {
    const slip = await postSlip({ employeeId, month: '2028-05' });       // created by the admin
    assert.equal((await patchAs(adminToken, slip.body.id, 'Approved')).status, 403);
    const approver = await mkStaff('approver');
    assert.equal((await patchAs(approver, slip.body.id, 'Approved')).status, 200);
  } finally {
    await setSeparate(false);
  }
});

test('with the setting off (default), a single admin can create and approve', async () => {
  const slip = await postSlip({ employeeId, month: '2028-06' });
  assert.equal((await patchAs(adminToken, slip.body.id, 'Approved')).status, 200);
});

test('only admin can change the setting; any staff can read it', async () => {
  const finance = await mkStaff('finance');
  assert.equal((await request.put('/settings').set('Authorization', `Bearer ${finance}`).send({ requireSeparateApprover: true })).status, 403);
  assert.equal((await setSeparate('yes')).status, 400);
  assert.equal((await request.get('/settings').set('Authorization', `Bearer ${finance}`)).status, 200);
});

// ---- employee attendance requests ----------------------------------------------------
const reqAs = (token) => ({
  post: (body) => request.post('/attendance-requests').set('Authorization', `Bearer ${token}`).send(body),
  list: () => request.get('/attendance-requests').set('Authorization', `Bearer ${token}`),
  del: (id) => request.delete(`/attendance-requests/${id}`).set('Authorization', `Bearer ${token}`),
  decide: (id, decision, note) =>
    request.patch(`/attendance-requests/${id}/decision`).set('Authorization', `Bearer ${token}`).send({ decision, note }),
});
const attendanceOf = async (month) =>
  (await request.get('/attendance').set('Authorization', `Bearer ${adminToken}`)).body.find((a) => a.employeeId === employeeId && a.month === month);
const submit = { present: 20, sick: 1, leave: 1, alpha: 0, overtimeHours: 8 };

test('a request does not change attendance until it is approved', async () => {
  const sent = await reqAs(employeeToken).post({ month: '2029-01', ...submit });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.status, 'Pending');
  assert.equal(await attendanceOf('2029-01'), undefined);

  const approver = await mkStaff('approver');
  const done = await reqAs(approver).decide(sent.body.id, 'Approved', 'ok');
  assert.equal(done.status, 200);
  assert.equal(done.body.status, 'Approved');
  const att = await attendanceOf('2029-01');
  assert.equal(att.overtimeHours, 8);
  assert.equal(att.present, 20);
});

test('a rejected request leaves attendance untouched and frees the month for a new one', async () => {
  const sent = await reqAs(employeeToken).post({ month: '2029-02', ...submit });
  assert.equal((await reqAs(adminToken).decide(sent.body.id, 'Rejected', 'tidak sesuai')).status, 200);
  assert.equal(await attendanceOf('2029-02'), undefined);
  assert.equal((await reqAs(employeeToken).post({ month: '2029-02', ...submit })).status, 201);
});

test('only one open request per month, even when sent at the same moment', async () => {
  const results = await Promise.all([1, 2, 3].map(() => reqAs(employeeToken).post({ month: '2029-03', ...submit })));
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409]);
});

test('a request can be decided only once', async () => {
  const sent = await reqAs(employeeToken).post({ month: '2029-04', ...submit });
  const decisions = await Promise.all([reqAs(adminToken).decide(sent.body.id, 'Approved'), reqAs(adminToken).decide(sent.body.id, 'Rejected')]);
  assert.deepEqual(decisions.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await reqAs(adminToken).decide(sent.body.id, 'Approved')).status, 409);
});

test('who may submit and who may decide', async () => {
  const sent = await reqAs(employeeToken).post({ month: '2029-05', ...submit });
  const finance = await mkStaff('finance');
  assert.equal((await reqAs(employeeToken).decide(sent.body.id, 'Approved')).status, 403);   // cannot approve own request
  assert.equal((await reqAs(finance).decide(sent.body.id, 'Approved')).status, 403);
  assert.equal((await reqAs(adminToken).post({ month: '2029-06', ...submit })).status, 403);   // staff do not submit
  assert.equal((await reqAs(adminToken).decide(sent.body.id, 'Maybe')).status, 400);
  assert.equal(await attendanceOf('2029-05'), undefined);
});

test('invalid submissions are refused and an employee sees only their own requests', async () => {
  assert.equal((await reqAs(employeeToken).post({ month: '2029-07', ...submit, overtimeHours: -3 })).status, 400);
  assert.equal((await reqAs(employeeToken).post({ month: 'bukan-bulan' })).status, 400);

  const other = await request.post('/employees').set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Other Person', role: 'QA', department: 'Eng', baseSalary: 7_000_000 });
  const otherEmail = `other-${unique}@test.local`;
  await request.post('/users').set('Authorization', `Bearer ${adminToken}`).send({ employeeId: other.body.id, email: otherEmail, password: 'otherpass123' });
  const otherToken = (await request.post('/auth/login').send({ email: otherEmail, password: 'otherpass123' })).body.token;
  const theirs = await reqAs(otherToken).post({ month: '2029-08', ...submit });

  const mine = (await reqAs(employeeToken).list()).body;
  assert.ok(mine.length > 0 && mine.every((r) => r.employeeId === employeeId));
  assert.equal((await reqAs(employeeToken).del(theirs.body.id)).status, 404);   // not theirs to withdraw
  assert.equal((await reqAs(otherToken).del(theirs.body.id)).status, 204);       // their own, still open
});

test('a slip takes overtime from the approved attendance when the request leaves it out, but an explicit value wins', async () => {
  const sent = await reqAs(employeeToken).post({ month: '2029-09', present: 20, sick: 0, leave: 0, alpha: 0, overtimeHours: 12 });
  // not approved yet: attendance has nothing, so overtime stays 0
  const before = await postSlip({ employeeId, month: '2029-09' });
  assert.equal(before.body.overtimeHours, 0);
  await request.delete(`/slips/${before.body.id}`).set('Authorization', `Bearer ${adminToken}`);

  assert.equal((await reqAs(adminToken).decide(sent.body.id, 'Approved')).status, 200);
  const auto = await postSlip({ employeeId, month: '2029-09' });
  assert.equal(auto.body.overtimeHours, 12);
  assert.ok(auto.body.overtimePay > 0);
  await request.delete(`/slips/${auto.body.id}`).set('Authorization', `Bearer ${adminToken}`);

  const explicit = await postSlip({ employeeId, month: '2029-09', overtimeHours: 0 });
  assert.equal(explicit.body.overtimeHours, 0);
  assert.equal(explicit.body.overtimePay, 0);
});

// ---- receipt confirmation ------------------------------------------------------------------
let receiptMonth = 0;
const paidSlip = async (reference) => {
  const month = `2031-${String(++receiptMonth).padStart(2, '0')}`;
  const slip = await postSlip({ employeeId, month });
  await patchStatus(slip.body.id, 'Approved');
  const paid = await request.patch(`/slips/${slip.body.id}/status`).set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'Paid', paymentReference: reference });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  return paid.body;
};
const receipt = (token, id, action, note) =>
  request.post(`/slips/${id}/receipt`).set('Authorization', `Bearer ${token}`).send({ action, note });
const slipOf = async (id) => (await request.get('/slips').set('Authorization', `Bearer ${adminToken}`)).body.find((s) => s.id === id);

test('marking a slip Paid stores the transfer reference and starts it awaiting confirmation', async () => {
  const paid = await paidSlip('  TRF-2031-001  ');
  assert.equal(paid.paymentReference, 'TRF-2031-001');
  assert.equal(paid.receiptStatus, 'Awaiting');
});

test('the reference is optional, bounded, and only valid together with Paid', async () => {
  const noRef = await paidSlip(undefined);
  assert.equal(noRef.paymentReference, undefined);
  assert.equal(noRef.receiptStatus, 'Awaiting');

  const slip = await postSlip({ employeeId, month: '2031-12' });
  const tooLong = await request.patch(`/slips/${slip.body.id}/status`).set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'Approved', paymentReference: 'x' });
  assert.equal(tooLong.status, 400);                       // reference with a non-Paid status
  await patchStatus(slip.body.id, 'Approved');
  const long = await request.patch(`/slips/${slip.body.id}/status`).set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'Paid', paymentReference: 'x'.repeat(101) });
  assert.equal(long.status, 400);
  assert.equal((await slipOf(slip.body.id)).status, 'Approved');
});

test('the employee confirms receipt once; the answer is final', async () => {
  const paid = await paidSlip('TRF-A');
  const ok = await receipt(employeeToken, paid.id, 'confirm');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.receiptStatus, 'Received');
  assert.ok(ok.body.receiptAt);
  assert.equal((await receipt(employeeToken, paid.id, 'confirm')).status, 409);
  assert.equal((await receipt(employeeToken, paid.id, 'dispute', 'salah')).status, 409);
});

test('only the slip owner, only when Paid, only as an employee', async () => {
  const paid = await paidSlip('TRF-B');
  const other = await request.post('/employees').set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Someone Else', role: 'QA', department: 'Eng', baseSalary: 7_000_000 });
  const otherEmail = `else-${unique}-${Math.random().toString(16).slice(2, 6)}@test.local`;
  await request.post('/users').set('Authorization', `Bearer ${adminToken}`).send({ employeeId: other.body.id, email: otherEmail, password: 'elsepass123' });
  const otherToken = (await request.post('/auth/login').send({ email: otherEmail, password: 'elsepass123' })).body.token;

  assert.equal((await receipt(otherToken, paid.id, 'confirm')).status, 404);        // someone else's slip
  assert.equal((await receipt(adminToken, paid.id, 'confirm')).status, 403);        // staff cannot confirm for them
  assert.equal((await slipOf(paid.id)).receiptStatus, 'Awaiting');

  const approved = await postSlip({ employeeId, month: '2031-11' });
  await patchStatus(approved.body.id, 'Approved');
  assert.equal((await receipt(employeeToken, approved.body.id, 'confirm')).status, 409);   // not paid yet
  assert.equal((await receipt(employeeToken, paid.id, 'maybe')).status, 400);
});

test('two simultaneous confirmations: exactly one wins', async () => {
  const paid = await paidSlip('TRF-C');
  const results = await Promise.all([1, 2, 3].map(() => receipt(employeeToken, paid.id, 'confirm')));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409, 409]);
});

test('a dispute needs a reason, staff must answer it, and the employee can then confirm', async () => {
  const paid = await paidSlip('TRF-D');
  assert.equal((await receipt(employeeToken, paid.id, 'dispute')).status, 400);          // no reason
  const disputed = await receipt(employeeToken, paid.id, 'dispute', 'Belum masuk rekening');
  assert.equal(disputed.body.receiptStatus, 'Disputed');
  assert.equal(disputed.body.disputeNote, 'Belum masuk rekening');
  assert.equal((await receipt(employeeToken, paid.id, 'confirm')).status, 409);          // must wait for staff

  const resolve = (token, body) =>
    request.post(`/slips/${paid.id}/resolve-dispute`).set('Authorization', `Bearer ${token}`).send(body);
  const finance = await mkStaff('finance');
  assert.equal((await resolve(employeeToken, { note: 'x' })).status, 403);
  assert.equal((await resolve(finance, { note: 'x' })).status, 403);
  assert.equal((await resolve(adminToken, {})).status, 400);                              // answer required
  const approver = await mkStaff('approver');
  const fixed = await resolve(approver, { note: 'Transfer ulang', paymentReference: 'TRF-D2' });
  assert.equal(fixed.status, 200);
  assert.equal(fixed.body.receiptStatus, 'Awaiting');
  assert.equal(fixed.body.paymentReference, 'TRF-D2');
  assert.equal(fixed.body.resolutionNote, 'Transfer ulang');
  assert.equal((await resolve(adminToken, { note: 'lagi' })).status, 409);                // nothing left to answer

  assert.equal((await receipt(employeeToken, paid.id, 'confirm')).body.receiptStatus, 'Received');
});

// ---- notifications for everything that needs action ----------------------------------------
const allNotifications = async (token) =>
  (await request.get('/notifications').set('Authorization', `Bearer ${token}`)).body;

test('slip submitted, approved and returned: the right people get a logged email', async () => {
  const finance = await mkStaff('finance');
  const approver = await mkStaff('approver');
  const slip = await request.post('/slips').set('Authorization', `Bearer ${finance}`).send({ employeeId, month: '2032-01' });
  await patchAs(finance, slip.body.id, 'Pending Approval');

  const afterSubmit = (await allNotifications(adminToken)).filter((n) => n.slipId === slip.body.id && n.kind === 'slip_needs_approval');
  assert.ok(afterSubmit.length >= 2, 'goes to the approver(s) and the admin, one row each');
  assert.equal(new Set(afterSubmit.map((n) => n.to)).size, afterSubmit.length, 'no address mailed twice');
  assert.ok(afterSubmit.every((n) => ['sent', 'skipped', 'failed'].includes(n.status)));
  assert.ok(!afterSubmit.some((n) => n.to.startsWith('finance-')), 'not to the person who submitted');

  await patchAs(approver, slip.body.id, 'Draft');            // sent back
  const returned = (await allNotifications(adminToken)).filter((n) => n.slipId === slip.body.id && n.kind === 'slip_returned');
  assert.equal(returned.length, 1);
  assert.ok(returned[0].to.startsWith('finance-'), 'goes to the slip creator');

  await patchAs(approver, slip.body.id, 'Approved');
  assert.ok((await allNotifications(adminToken)).some((n) => n.slipId === slip.body.id && n.kind === 'slip_ready_to_pay'));
});

test('an employee sees only mail addressed to them, never the staff approval mail', async () => {
  await putEmployee(employeeId, { email: `emp-${unique}@test.local` });   // earlier tests edited the record without an email
  const sent = await reqAs(employeeToken).post({ month: '2032-02', present: 10, sick: 0, leave: 0, alpha: 0, overtimeHours: 4 });
  const staffView = await allNotifications(adminToken);
  assert.ok(staffView.some((n) => n.kind === 'attendance_needs_approval' && n.slipId === undefined));

  const mine = await allNotifications(employeeToken);
  assert.ok(!mine.some((n) => n.kind === 'attendance_needs_approval' || n.kind === 'slip_needs_approval' || n.kind === 'slip_ready_to_pay'));

  await reqAs(adminToken).decide(sent.body.id, 'Rejected', 'data tidak cocok');
  const decided = (await allNotifications(employeeToken)).filter((n) => n.kind === 'attendance_decided');
  assert.ok(decided.length >= 1);
  assert.ok(decided[0].to.startsWith('emp-'), 'sent to the address on the employee record');
});

test('a dispute alerts the approvers and the answer alerts the employee', async () => {
  const paid = await paidSlip('TRF-N');
  await receipt(employeeToken, paid.id, 'dispute', 'Belum masuk');
  assert.ok((await allNotifications(adminToken)).some((n) => n.slipId === paid.id && n.kind === 'dispute_opened'));

  await request.post(`/slips/${paid.id}/resolve-dispute`).set('Authorization', `Bearer ${adminToken}`).send({ note: 'Dicek, transfer ulang' });
  const answered = (await allNotifications(employeeToken)).filter((n) => n.slipId === paid.id && n.kind === 'dispute_answered');
  assert.equal(answered.length, 1);
});

test('names in notification emails are escaped, so a name cannot inject markup', async () => {
  const emp = await request.post('/employees').set('Authorization', `Bearer ${adminToken}`)
    .send({ name: '<b>x</b>', email: `esc-${unique}@test.local`, role: 'QA', department: 'Eng', baseSalary: 6_000_000 });
  const slip = await postSlip({ employeeId: emp.body.id, month: '2032-03' });
  await patchStatus(slip.body.id, 'Pending Approval');
  const row = (await allNotifications(adminToken)).find((n) => n.slipId === slip.body.id && n.kind === 'slip_needs_approval');
  assert.ok(row, 'notification exists');
  // subject is plain text, the body is what is escaped; the stored detail never contains raw markup from the name
  assert.ok(!row.detail.includes('<b>'));
});

test.after(() => pool.end());
