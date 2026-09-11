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

test.after(() => pool.end());
