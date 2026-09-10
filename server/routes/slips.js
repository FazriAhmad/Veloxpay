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

const formatIDR = (n) => `Rp ${Math.round(Number(n)).toLocaleString('id-ID')}`;

// ponytail: one company-wide floor instead of real per-province/city UMR/UMK data,
// which changes yearly and varies by region. Swap in a regional table before this
// drives a real compliance check. Using DKI Jakarta's 2024 UMP as a placeholder.
const REGIONAL_MINIMUM_WAGE = 5_067_381;

export const slipsRouter = Router();
slipsRouter.use(requireAuth);

const SLIP_COLUMNS = `id, employee_id, employee_name, employee_role, employee_department, month,
  base_salary, bank_name, bank_account, allowances, deductions, overtime_pay, overtime_hours,
  gross_salary, net_salary, status, approved_by, payment_date, generated_at`;

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

slipsRouter.post('/', requireRole('admin'), wrapAsync(async (req, res) => {
  const {
    employeeId, employeeName, employeeRole, employeeDepartment, month, baseSalary,
    bankName, bankAccount, allowances = [], deductions: customDeductions = [], overtimePay = 0, overtimeHours = 0,
  } = req.body || {};
  if (!employeeId || !month || !baseSalary) {
    return res.status(400).json({ error: 'employeeId, month, dan baseSalary wajib diisi.' });
  }

  const dup = await pool.query('SELECT id FROM payroll_slips WHERE employee_id=$1 AND month=$2 AND company_id=$3', [
    employeeId,
    month,
    req.auth.companyId,
  ]);
  if (dup.rows.length > 0) {
    return res.status(409).json({ error: 'Slip untuk karyawan dan periode ini sudah ada.' });
  }

  const empRow = await pool.query('SELECT ptkp_status FROM employees WHERE id=$1 AND company_id=$2', [
    employeeId,
    req.auth.companyId,
  ]);
  if (empRow.rows.length === 0) return res.status(404).json({ error: 'Karyawan tidak ditemukan.' });
  const ptkpStatus = empRow.rows[0].ptkp_status;

  const allowanceTotal = allowances.reduce((sum, a) => sum + Number(a.amount), 0);
  const monthlyGrossForTax = Number(baseSalary) + Number(overtimePay) + allowanceTotal;

  // PPh 21 and BPJS are computed here, server-side, from statutory rates — not taken
  // from client input — so they can't be edited away or left out from the UI.
  const pph21 = calculatePph21Monthly(monthlyGrossForTax, ptkpStatus);
  const bpjs = calculateBpjsEmployeeDeductions(Number(baseSalary));

  const statutoryDeductions = [
    ...(pph21 > 0 ? [{ name: 'PPh 21 (estimasi)', amount: pph21 }] : []),
    { name: 'BPJS Kesehatan (1%)', amount: bpjs.kesehatan },
    { name: 'BPJS Ketenagakerjaan - JHT (2%)', amount: bpjs.jht },
    { name: 'BPJS Ketenagakerjaan - JP (1%)', amount: bpjs.jp },
  ];
  const deductions = [...customDeductions, ...statutoryDeductions];
  const deductionTotal = deductions.reduce((sum, d) => sum + Number(d.amount), 0);
  const grossSalary = monthlyGrossForTax;
  const netSalary = grossSalary - deductionTotal;

  const id = `PAY-${month.replace('-', '')}-${randomUUID().slice(0, 4).toUpperCase()}`;
  const result = await pool.query(
    `INSERT INTO payroll_slips
      (id, company_id, employee_id, employee_name, employee_role, employee_department, month, base_salary,
       bank_name, bank_account, allowances, deductions, overtime_pay, overtime_hours, gross_salary, net_salary, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'Draft')
     RETURNING ${SLIP_COLUMNS}`,
    [id, req.auth.companyId, employeeId, employeeName, employeeRole, employeeDepartment, month, baseSalary,
     bankName, bankAccount, JSON.stringify(allowances), JSON.stringify(deductions), overtimePay, overtimeHours,
     grossSalary, netSalary]
  );
  await writeAuditLog(
    req.auth,
    'GENERATE_PAYROLL',
    `Membuat draf slip gaji untuk ${employeeName} periode ${month} (PPh21: ${pph21}, BPJS: ${bpjs.total})`
  );

  const warnings = [];
  if (isBelowMinimumWage(Number(baseSalary), REGIONAL_MINIMUM_WAGE)) {
    warnings.push(
      `Gaji pokok di bawah upah minimum acuan (${REGIONAL_MINIMUM_WAGE.toLocaleString('id-ID')}). Verifikasi dengan UMR/UMK daerah karyawan.`
    );
  }

  res.status(201).json({ ...toSlipDTO(result.rows[0]), warnings });
}));

// Approval workflow — never triggers any transfer, only changes the record's status.
slipsRouter.patch('/:id/status', requireRole('admin'), wrapAsync(async (req, res) => {
  const { status } = req.body || {};
  const allowed = ['Draft', 'Pending Approval', 'Approved', 'Paid'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Status tidak valid.' });

  const approvedBy = status === 'Approved' || status === 'Paid' ? req.auth.name : null;
  const paymentDate = status === 'Paid' ? new Date() : null;

  const result = await pool.query(
    `UPDATE payroll_slips
     SET status=$1, approved_by=COALESCE($2, approved_by), payment_date=COALESCE($3, payment_date)
     WHERE id=$4 AND company_id=$5 RETURNING ${SLIP_COLUMNS}`,
    [status, approvedBy, paymentDate, req.params.id, req.auth.companyId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Slip tidak ditemukan.' });

  const slip = result.rows[0];
  const actionLabel =
    status === 'Paid' ? 'MARK_PAID' : status === 'Approved' ? 'APPROVE_PAYROLL' : 'UPDATE_PAYROLL_STATUS';
  const detail =
    status === 'Paid'
      ? `Menandai slip ${slip.id} (${slip.employee_name}) sebagai Sudah Dibayar — konfirmasi manual, bukan transaksi yang diproses VeloxPay.`
      : `Mengubah status slip ${slip.id} (${slip.employee_name}) menjadi ${status}`;
  await writeAuditLog(req.auth, actionLabel, detail);

  // A slip becoming "Paid" is the trigger to actually notify the employee — real PDF
  // attached, real (or honestly-skipped) email. Failures here don't roll back the
  // status change: the payroll record is the source of truth, the email is best-effort.
  if (status === 'Paid') {
    const empRow = await pool.query('SELECT email FROM employees WHERE id=$1', [slip.employee_id]);
    const toEmail = empRow.rows[0]?.email;
    const slipDto = toSlipDTO(slip);

    let mailResult;
    try {
      const pdfBuffer = await renderPayslipPdf(slipDto);
      mailResult = await sendPayslipEmail({
        to: toEmail,
        subject: `Slip Gaji Digital VeloxPay - ${slip.month}`,
        html: `<p>Halo ${slip.employee_name},</p><p>Slip gaji Anda untuk periode ${slip.month} telah terbit dan ditandai sudah dibayar. Take-home pay: <strong>${formatIDR(slip.net_salary)}</strong>.</p><p>Dokumen PDF terlampir.</p><p>— VeloxPay</p>`,
        attachment: { filename: `${slip.id}.pdf`, buffer: pdfBuffer },
      });
    } catch (err) {
      mailResult = { status: 'failed', detail: `Gagal membuat PDF: ${err.message}` };
    }

    await pool.query(
      `INSERT INTO notification_log (id, company_id, slip_id, to_email, subject, status, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        `NOTIF-${randomUUID().slice(0, 8)}`,
        req.auth.companyId,
        slip.id,
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

slipsRouter.delete('/:id', requireRole('admin'), wrapAsync(async (req, res) => {
  const result = await pool.query('DELETE FROM payroll_slips WHERE id=$1 AND company_id=$2 RETURNING id', [
    req.params.id,
    req.auth.companyId,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Slip tidak ditemukan.' });
  await writeAuditLog(req.auth, 'DELETE_PAYROLL', `Menghapus slip gaji ${req.params.id} dari riwayat.`);
  res.status(204).end();
}));
