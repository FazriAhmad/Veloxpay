import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { toSlipDTO } from '../mappers.js';
import { writeAuditLog } from '../auditLog.js';
import { wrapAsync } from '../wrapAsync.js';
import { calculatePph21Monthly, calculateBpjsEmployeeDeductions, isBelowMinimumWage } from '../payrollEngine.js';
import { renderPayslipPdf } from '../pdf.js';
import { sendPayslipEmail } from '../mailer.js';
import { notify, esc } from '../notify.js';
import { encryptField, decryptField } from '../crypto.js';
import {
  MONTH_PATTERN, SLIP_STATUSES, parseLineItems, parseOvertimeHours, calculateOvertimePay, canTransition, isDeletable, rolesForTransition, parseText,
} from '../slipRules.js';

const formatIDR = (n) => `Rp ${Math.round(Number(n)).toLocaleString('id-ID')}`;

// ponytail: one company-wide floor instead of real per-province/city UMR/UMK data,
// which changes yearly and varies by region. Swap in a regional table before this
// drives a real compliance check. Using DKI Jakarta's 2024 UMP as a placeholder.
const REGIONAL_MINIMUM_WAGE = 5_067_381;

export const slipsRouter = Router();
slipsRouter.use(requireAuth);

const SLIP_COLUMNS = `id, employee_id, employee_name, employee_role, employee_department, month,
  base_salary, bank_name, bank_account, allowances, deductions, overtime_pay, overtime_hours,
  gross_salary, net_salary, status, approved_by, payment_date, generated_at, created_by,
  payment_reference, receipt_status, receipt_at, dispute_note, resolution_note`;

slipsRouter.get('/', wrapAsync(async (req, res) => {
  const scopedToSelf = req.auth.role === 'employee';
  const result = scopedToSelf
    ? await pool.query(
        `SELECT ${SLIP_COLUMNS} FROM payroll_slips WHERE company_id = $1 AND employee_id = $2 ORDER BY generated_at DESC`,
        [req.auth.companyId, req.auth.employeeId]
      )
    : await pool.query(`SELECT ${SLIP_COLUMNS} FROM payroll_slips WHERE company_id = $1 ORDER BY generated_at DESC`, [
        req.auth.companyId,
      ]);
  res.json(result.rows.map(toSlipDTO));
}));

// What a slip says about the employee and their pay comes from the employee's own
// record, never from the request body. The body used to supply baseSalary, the bank
// account and even the name, so a request could issue a slip paying a different
// amount to a different account than the one on file. The client now only chooses
// who, which month, and the optional extras (allowances, custom deductions, hours).
slipsRouter.post('/', requireRole('admin', 'finance'), wrapAsync(async (req, res) => {
  const { employeeId, month } = req.body || {};
  if (!employeeId || !month) {
    return res.status(400).json({ error: 'employeeId dan month wajib diisi.' });
  }
  if (typeof month !== 'string' || !MONTH_PATTERN.test(month)) {
    return res.status(400).json({ error: 'month harus berformat YYYY-MM, mis. 2026-09.' });
  }

  const allowanceResult = parseLineItems(req.body.allowances, 'Tunjangan');
  if (allowanceResult.error) return res.status(400).json({ error: allowanceResult.error });
  const deductionResult = parseLineItems(req.body.deductions, 'Potongan');
  if (deductionResult.error) return res.status(400).json({ error: deductionResult.error });
  const overtimeResult = parseOvertimeHours(req.body.overtimeHours);
  if (overtimeResult.error) return res.status(400).json({ error: overtimeResult.error });

  const empRow = await pool.query('SELECT * FROM employees WHERE id=$1 AND company_id=$2', [
    employeeId,
    req.auth.companyId,
  ]);
  if (empRow.rows.length === 0) return res.status(404).json({ error: 'Karyawan tidak ditemukan.' });
  const emp = empRow.rows[0];

  const baseSalary = Number(emp.base_salary);
  if (!Number.isFinite(baseSalary) || baseSalary <= 0) {
    return res.status(422).json({ error: 'Gaji pokok karyawan tidak valid; perbaiki data karyawan terlebih dahulu.' });
  }
  const allowances = allowanceResult.items;
  const customDeductions = deductionResult.items;
  // Left out of the request -> use what attendance holds for that month (this is where approved
  // employee requests land). Sent explicitly -> that value wins, even 0.
  let overtimeHours = overtimeResult.hours;
  if (req.body.overtimeHours === undefined || req.body.overtimeHours === null || req.body.overtimeHours === '') {
    const att = await pool.query('SELECT overtime_hours FROM attendance WHERE employee_id=$1 AND month=$2', [emp.id, month]);
    overtimeHours = Number(att.rows[0]?.overtime_hours ?? 0);
  }
  const overtimePay = calculateOvertimePay(baseSalary, overtimeHours);

  const allowanceTotal = allowances.reduce((sum, a) => sum + a.amount, 0);
  const monthlyGrossForTax = baseSalary + overtimePay + allowanceTotal;

  // PPh 21 and BPJS are computed here, server-side, from statutory rates — not taken
  // from client input — so they can't be edited away or left out from the UI.
  const pph21 = calculatePph21Monthly(monthlyGrossForTax, emp.ptkp_status);
  const bpjs = calculateBpjsEmployeeDeductions(baseSalary);

  const statutoryDeductions = [
    ...(pph21 > 0 ? [{ name: 'PPh 21 (estimasi)', amount: pph21 }] : []),
    { name: 'BPJS Kesehatan (1%)', amount: bpjs.kesehatan },
    { name: 'BPJS Ketenagakerjaan - JHT (2%)', amount: bpjs.jht },
    { name: 'BPJS Ketenagakerjaan - JP (1%)', amount: bpjs.jp },
  ];
  const deductions = [...customDeductions, ...statutoryDeductions];
  const deductionTotal = deductions.reduce((sum, d) => sum + d.amount, 0);
  const grossSalary = monthlyGrossForTax;
  const netSalary = grossSalary - deductionTotal;
  if (!Number.isFinite(netSalary) || netSalary < 0) {
    return res.status(400).json({ error: 'Total potongan melebihi total pendapatan; take-home pay tidak boleh negatif.' });
  }

  // 8 hex characters rather than 4: a 4-character suffix has only 65,536 values per
  // month, which is a ~7% chance of a clash at 100 slips and ~50% at 300.
  const id = `PAY-${month.replace('-', '')}-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  // The account number is copied from the employee record rather than taken from the
  // request. Re-encrypting the decrypted value also normalises any row that predates
  // field encryption and still holds plaintext (see decryptField).
  const bankAccountForSlip = encryptField(decryptField(emp.bank_account));

  let result;
  try {
    result = await pool.query(
      `INSERT INTO payroll_slips
        (id, company_id, employee_id, employee_name, employee_role, employee_department, month, base_salary,
         bank_name, bank_account, allowances, deductions, overtime_pay, overtime_hours, gross_salary, net_salary, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'Draft',$17)
       RETURNING ${SLIP_COLUMNS}`,
      [id, req.auth.companyId, emp.id, emp.name, emp.role, emp.department, month, baseSalary,
       emp.bank_name, bankAccountForSlip, JSON.stringify(allowances), JSON.stringify(deductions),
       overtimePay, overtimeHours, grossSalary, netSalary, req.auth.userId]
    );
  } catch (err) {
    // The unique index, not a SELECT beforehand, is what decides: two simultaneous
    // requests can both pass a check-then-insert, but only one can win the index.
    if (err.code === '23505' && err.constraint === 'payroll_slips_company_employee_month_key') {
      return res.status(409).json({ error: 'Slip untuk karyawan dan periode ini sudah ada.' });
    }
    throw err;
  }
  await writeAuditLog(
    req.auth,
    'GENERATE_PAYROLL',
    `Membuat draf slip gaji untuk ${emp.name} periode ${month} (PPh21: ${pph21}, BPJS: ${bpjs.total})`
  );

  const warnings = [];
  if (isBelowMinimumWage(baseSalary, REGIONAL_MINIMUM_WAGE)) {
    warnings.push(
      `Gaji pokok di bawah upah minimum acuan (${REGIONAL_MINIMUM_WAGE.toLocaleString('id-ID')}). Verifikasi dengan UMR/UMK daerah karyawan.`
    );
  }

  res.status(201).json({ ...toSlipDTO(result.rows[0]), warnings });
}));

// Approval workflow — never triggers any transfer, only changes the record's status.
slipsRouter.patch('/:id/status', wrapAsync(async (req, res) => {
  const { status } = req.body || {};
  if (!SLIP_STATUSES.includes(status)) return res.status(400).json({ error: 'Status tidak valid.' });
  const ref = parseText(req.body.paymentReference, { max: 100, label: 'Nomor referensi' });
  if (ref.error) return res.status(400).json({ error: ref.error });
  if (ref.text && status !== 'Paid') return res.status(400).json({ error: 'Nomor referensi hanya untuk status Paid.' });

  const current = await pool.query('SELECT status, created_by FROM payroll_slips WHERE id=$1 AND company_id=$2', [
    req.params.id,
    req.auth.companyId,
  ]);
  if (current.rows.length === 0) return res.status(404).json({ error: 'Slip tidak ditemukan.' });
  const from = current.rows[0].status;

  if (!canTransition(from, status)) {
    return res.status(409).json({ error: `Status slip tidak bisa diubah dari ${from} ke ${status}.` });
  }

  if (!rolesForTransition(from, status).includes(req.auth.role)) {
    return res.status(403).json({ error: 'Peran Anda tidak boleh melakukan perubahan status ini.' });
  }
  if (status === 'Approved' && current.rows[0].created_by === req.auth.userId) {
    const setting = await pool.query('SELECT require_separate_approver FROM companies WHERE id=$1', [req.auth.companyId]);
    if (setting.rows[0]?.require_separate_approver) {
      return res.status(403).json({ error: 'Pembuat slip tidak boleh menyetujui slipnya sendiri.' });
    }
  }

  const approvedBy = status === 'Approved' || status === 'Paid' ? req.auth.name : null;
  const paymentDate = status === 'Paid' ? new Date() : null;

  // "AND status = $6" makes the change conditional on the slip still being in the
  // state we just checked. Without it two concurrent "Paid" requests both pass the
  // check above and each sends the employee an email; with it only one update
  // matches and the other is turned away.
  const result = await pool.query(
    `UPDATE payroll_slips
     SET status=$1,
         approved_by = CASE WHEN $1 IN ('Approved', 'Paid') THEN COALESCE($2, approved_by) ELSE NULL END,
         payment_date = CASE WHEN $1 = 'Paid' THEN $3 ELSE payment_date END,
         payment_reference = CASE WHEN $1 = 'Paid' THEN $7 ELSE payment_reference END,
         receipt_status = CASE WHEN $1 = 'Paid' THEN 'Awaiting' ELSE receipt_status END
     WHERE id=$4 AND company_id=$5 AND status=$6 RETURNING ${SLIP_COLUMNS}`,
    [status, approvedBy, paymentDate, req.params.id, req.auth.companyId, from, ref.text]
  );
  if (result.rows.length === 0) {
    return res.status(409).json({ error: 'Status slip baru saja berubah. Muat ulang lalu coba lagi.' });
  }

  const slip = result.rows[0];
  const actionLabel =
    status === 'Paid' ? 'MARK_PAID' : status === 'Approved' ? 'APPROVE_PAYROLL' : 'UPDATE_PAYROLL_STATUS';
  const detail =
    status === 'Paid'
      ? `Menandai slip ${slip.id} (${slip.employee_name}) sebagai Sudah Dibayar — konfirmasi manual, bukan transaksi yang diproses VeloxPay.`
      : `Mengubah status slip ${slip.id} (${slip.employee_name}) dari ${from} menjadi ${status}`;
  await writeAuditLog(req.auth, actionLabel, detail);

  // Tell whoever has to act next. Paid has its own email (with the PDF) below.
  const label = `${slip.employee_name} periode ${slip.month}`;
  if (status === 'Pending Approval') {
    await notify({
      companyId: req.auth.companyId, to: { roles: ['approver', 'admin'] }, slipId: slip.id, kind: 'slip_needs_approval',
      subject: `[VeloxPay] Slip gaji menunggu persetujuan: ${label}`,
      html: `<p>Slip gaji <strong>${esc(label)}</strong> (${formatIDR(slip.net_salary)}) diajukan oleh ${esc(req.auth.name)} dan menunggu persetujuan Anda di VeloxPay.</p>`,
    });
  } else if (status === 'Approved') {
    await notify({
      companyId: req.auth.companyId, to: { roles: ['approver', 'admin'] }, slipId: slip.id, kind: 'slip_ready_to_pay',
      subject: `[VeloxPay] Slip gaji siap dibayar: ${label}`,
      html: `<p>Slip gaji <strong>${esc(label)}</strong> (${formatIDR(slip.net_salary)}) sudah disetujui ${esc(req.auth.name)}. Setelah transfer dilakukan, tandai sebagai dibayar dan isi nomor referensi di VeloxPay.</p>`,
    });
  } else if (status === 'Draft' && from === 'Pending Approval' && slip.created_by) {
    await notify({
      companyId: req.auth.companyId, to: { userIds: [slip.created_by] }, slipId: slip.id, kind: 'slip_returned',
      subject: `[VeloxPay] Slip gaji dikembalikan ke draf: ${label}`,
      html: `<p>Slip gaji <strong>${esc(label)}</strong> dikembalikan ke draf oleh ${esc(req.auth.name)}. Periksa dan ajukan kembali.</p>`,
    });
  }

  // A slip becoming "Paid" is the trigger to actually notify the employee — real PDF
  // attached, real (or honestly-skipped) email. Failures here don't roll back the
  // status change: the payroll record is the source of truth, the email is best-effort.
  if (status === 'Paid') {
    const empRow = await pool.query('SELECT email FROM employees WHERE id=$1 AND company_id=$2', [
      slip.employee_id,
      req.auth.companyId,
    ]);
    const toEmail = empRow.rows[0]?.email;
    const slipDto = toSlipDTO(slip);

    let mailResult;
    try {
      const pdfBuffer = await renderPayslipPdf(slipDto);
      mailResult = await sendPayslipEmail({
        to: toEmail,
        subject: `Slip Gaji Digital VeloxPay - ${slip.month}`,
        html: `<p>Halo ${esc(slip.employee_name)},</p><p>Slip gaji Anda untuk periode ${esc(slip.month)} telah terbit dan ditandai sudah dibayar. Take-home pay: <strong>${formatIDR(slip.net_salary)}</strong>.${slip.payment_reference ? ` Nomor referensi transfer: <strong>${esc(slip.payment_reference)}</strong>.` : ''}</p><p>Mohon konfirmasi di VeloxPay apakah gaji sudah Anda terima (Riwayat Slip &rarr; Sudah Diterima / Belum Diterima).</p><p>Dokumen PDF terlampir.</p><p>— VeloxPay</p>`,
        attachment: { filename: `${slip.id}.pdf`, buffer: pdfBuffer },
      });
    } catch (err) {
      mailResult = { status: 'failed', detail: `Gagal membuat PDF: ${err.message}` };
    }

    await pool.query(
      `INSERT INTO notification_log (id, company_id, slip_id, recipient_employee_id, kind, to_email, subject, status, detail)
       VALUES ($1,$2,$3,$4,'payslip_paid',$5,$6,$7,$8)`,
      [
        `NOTIF-${randomUUID().slice(0, 8)}`,
        req.auth.companyId,
        slip.id,
        slip.employee_id,
        toEmail || '(tidak ada email)',
        `Slip Gaji Digital VeloxPay - ${slip.month}`,
        mailResult.status,
        mailResult.detail,
      ]
    );
    await writeAuditLog(
      req.auth,
      'SEND_EMAIL_PAYSLIP',
      `Notifikasi email slip ${slip.id} ke ${toEmail || '(tidak ada email)'}: ${mailResult.status} — ${mailResult.detail}`
    );
  }

  res.json(toSlipDTO(slip));
}));

// The employee's side of a payment: confirm the money arrived, or say it did not. Only the slip's
// owner, only while the slip is Paid and awaiting an answer. The UPDATE repeats those conditions so
// two quick requests cannot both succeed.
slipsRouter.post('/:id/receipt', requireRole('employee'), wrapAsync(async (req, res) => {
  const { action } = req.body || {};
  if (action !== 'confirm' && action !== 'dispute') {
    return res.status(400).json({ error: 'action harus confirm atau dispute.' });
  }
  const note = parseText(req.body.note, { max: 500, label: 'Alasan', required: action === 'dispute' });
  if (note.error) return res.status(400).json({ error: note.error });

  const result = await pool.query(
    `UPDATE payroll_slips
     SET receipt_status = $1, receipt_at = now(),
         dispute_note = CASE WHEN $1 = 'Disputed' THEN $2 ELSE dispute_note END
     WHERE id=$3 AND company_id=$4 AND employee_id=$5 AND status='Paid' AND receipt_status='Awaiting'
     RETURNING ${SLIP_COLUMNS}`,
    [action === 'confirm' ? 'Received' : 'Disputed', note.text, req.params.id, req.auth.companyId, req.auth.employeeId]
  );
  if (result.rows.length === 0) {
    const own = await pool.query('SELECT 1 FROM payroll_slips WHERE id=$1 AND company_id=$2 AND employee_id=$3', [
      req.params.id, req.auth.companyId, req.auth.employeeId,
    ]);
    if (own.rows.length === 0) return res.status(404).json({ error: 'Slip tidak ditemukan.' });
    return res.status(409).json({ error: 'Slip ini belum dibayar atau penerimaannya sudah dijawab.' });
  }
  const slip = result.rows[0];
  await writeAuditLog(
    req.auth,
    action === 'confirm' ? 'CONFIRM_RECEIPT' : 'DISPUTE_RECEIPT',
    action === 'confirm'
      ? `Karyawan mengonfirmasi gaji slip ${slip.id} sudah diterima.`
      : `Karyawan menyatakan gaji slip ${slip.id} belum diterima: ${note.text}`
  );
  if (action === 'dispute') {
    await notify({
      companyId: req.auth.companyId, to: { roles: ['approver', 'admin'] }, slipId: slip.id, kind: 'dispute_opened',
      subject: `[VeloxPay] ${slip.employee_name} belum menerima gaji ${slip.month}`,
      html: `<p><strong>${esc(slip.employee_name)}</strong> menyatakan gaji slip ${esc(slip.id)} belum diterima.</p><p>Alasan: ${esc(note.text)}</p><p>Periksa pembayaran lalu tanggapi di VeloxPay (Status Pembayaran).</p>`,
    });
  }
  res.json(toSlipDTO(slip));
}));

// Staff answer to a dispute: record what was checked or fixed (optionally a new transfer reference);
// the slip goes back to waiting for the employee's confirmation.
slipsRouter.post('/:id/resolve-dispute', requireRole('admin', 'approver'), wrapAsync(async (req, res) => {
  const note = parseText(req.body?.note, { max: 500, label: 'Tanggapan', required: true });
  if (note.error) return res.status(400).json({ error: note.error });
  const ref = parseText(req.body?.paymentReference, { max: 100, label: 'Nomor referensi' });
  if (ref.error) return res.status(400).json({ error: ref.error });

  const result = await pool.query(
    `UPDATE payroll_slips
     SET receipt_status = 'Awaiting', resolution_note = $1, payment_reference = COALESCE($2, payment_reference)
     WHERE id=$3 AND company_id=$4 AND receipt_status='Disputed' RETURNING ${SLIP_COLUMNS}`,
    [note.text, ref.text, req.params.id, req.auth.companyId]
  );
  if (result.rows.length === 0) {
    return res.status(409).json({ error: 'Slip tidak ditemukan atau tidak sedang dipersoalkan.' });
  }
  await writeAuditLog(req.auth, 'RESOLVE_DISPUTE', `Menanggapi persoalan slip ${req.params.id}: ${note.text}`);
  const fixed = result.rows[0];
  await notify({
    companyId: req.auth.companyId, to: { employeeId: fixed.employee_id }, slipId: fixed.id, kind: 'dispute_answered',
    subject: `[VeloxPay] Mohon konfirmasi ulang penerimaan gaji ${fixed.month}`,
    html: `<p>Halo ${esc(fixed.employee_name)},</p><p>Petugas menanggapi laporan Anda: ${esc(note.text)}</p>${fixed.payment_reference ? `<p>Nomor referensi transfer: <strong>${esc(fixed.payment_reference)}</strong></p>` : ''}<p>Mohon konfirmasi di VeloxPay apakah gaji sudah Anda terima.</p>`,
  });
  res.json(toSlipDTO(fixed));
}));

// Streams the same PDF that gets emailed on payment — this is what "Unduh PDF" now
// actually downloads, generated fresh from the stored slip data.
slipsRouter.get('/:id/pdf', wrapAsync(async (req, res) => {
  const scopedToSelf = req.auth.role === 'employee';
  const result = scopedToSelf
    ? await pool.query(`SELECT ${SLIP_COLUMNS} FROM payroll_slips WHERE id=$1 AND company_id=$2 AND employee_id=$3`, [
        req.params.id,
        req.auth.companyId,
        req.auth.employeeId,
      ])
    : await pool.query(`SELECT ${SLIP_COLUMNS} FROM payroll_slips WHERE id=$1 AND company_id=$2`, [
        req.params.id,
        req.auth.companyId,
      ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Slip tidak ditemukan.' });

  const pdfBuffer = await renderPayslipPdf(toSlipDTO(result.rows[0]));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.pdf"`);
  res.send(pdfBuffer);
}));

// Only drafts can be removed. Once a slip is approved it is a financial record that
// the audit log refers to by id; deleting it would leave that trail pointing at nothing.
slipsRouter.delete('/:id', requireRole('admin', 'finance'), wrapAsync(async (req, res) => {
  const found = await pool.query('SELECT status FROM payroll_slips WHERE id=$1 AND company_id=$2', [
    req.params.id,
    req.auth.companyId,
  ]);
  if (found.rows.length === 0) return res.status(404).json({ error: 'Slip tidak ditemukan.' });
  if (!isDeletable(found.rows[0].status)) {
    return res.status(409).json({ error: 'Slip yang sudah disetujui atau dibayar tidak dapat dihapus.' });
  }

  // The status is repeated in the DELETE so a slip approved between the check above
  // and this statement is not deleted by mistake.
  const result = await pool.query(
    "DELETE FROM payroll_slips WHERE id=$1 AND company_id=$2 AND status IN ('Draft', 'Pending Approval') RETURNING id",
    [req.params.id, req.auth.companyId]
  );
  if (result.rows.length === 0) {
    return res.status(409).json({ error: 'Status slip baru saja berubah. Muat ulang lalu coba lagi.' });
  }
  await writeAuditLog(req.auth, 'DELETE_PAYROLL', `Menghapus draf slip gaji ${req.params.id} dari riwayat.`);
  res.status(204).end();
}));
