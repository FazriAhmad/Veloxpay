import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { toSlipDTO } from '../mappers.js';
import { writeAuditLog } from '../auditLog.js';
import { wrapAsync } from '../wrapAsync.js';

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
    bankName, bankAccount, allowances = [], deductions = [], overtimePay = 0, overtimeHours = 0,
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

  const allowanceTotal = allowances.reduce((sum, a) => sum + Number(a.amount), 0);
  const deductionTotal = deductions.reduce((sum, d) => sum + Number(d.amount), 0);
  const grossSalary = Number(baseSalary) + Number(overtimePay) + allowanceTotal;
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
  await writeAuditLog(req.auth, 'GENERATE_PAYROLL', `Membuat draf slip gaji untuk ${employeeName} periode ${month}`);
  res.status(201).json(toSlipDTO(result.rows[0]));
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

  res.json(toSlipDTO(slip));
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
