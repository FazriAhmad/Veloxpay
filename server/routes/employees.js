import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { toEmployeeDTO } from '../mappers.js';
import { writeAuditLog } from '../auditLog.js';
import { wrapAsync } from '../wrapAsync.js';
import { calculateThr, isBelowMinimumWage, getPtkpStatuses } from '../payrollEngine.js';

// See routes/slips.js for why this is a single placeholder floor rather than real
// per-region UMR/UMK data.
const REGIONAL_MINIMUM_WAGE = 5_067_381;
const VALID_PTKP = new Set(getPtkpStatuses());

export const employeesRouter = Router();
employeesRouter.use(requireAuth);

// Admin sees everyone in the company; an employee only ever sees their own record.
employeesRouter.get('/', wrapAsync(async (req, res) => {
  const scopedToSelf = req.auth.role === 'employee';
  const result = scopedToSelf
    ? await pool.query('SELECT * FROM employees WHERE company_id = $1 AND id = $2', [
        req.auth.companyId,
        req.auth.employeeId,
      ])
    : await pool.query('SELECT * FROM employees WHERE company_id = $1 ORDER BY join_date', [req.auth.companyId]);
  res.json(result.rows.map(toEmployeeDTO));
}));

employeesRouter.post('/', requireRole('admin'), wrapAsync(async (req, res) => {
  const { name, email, role, department, baseSalary, bankName, bankAccount, joinDate, ptkpStatus } = req.body || {};
  if (!name || !role || !department || !baseSalary) {
    return res.status(400).json({ error: 'name, role, department, dan baseSalary wajib diisi.' });
  }
  if (Number(baseSalary) <= 0) return res.status(400).json({ error: 'baseSalary harus lebih dari 0.' });
  if (ptkpStatus && !VALID_PTKP.has(ptkpStatus)) {
    return res.status(400).json({ error: `Status PTKP tidak valid. Gunakan salah satu: ${[...VALID_PTKP].join(', ')}.` });
  }

  const id = `EMP-${randomUUID().slice(0, 6).toUpperCase()}`;
  const result = await pool.query(
    `INSERT INTO employees (id, company_id, name, email, role, department, base_salary, bank_name, bank_account, join_date, ptkp_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [id, req.auth.companyId, name, email || null, role, department, baseSalary, bankName || null, bankAccount || null,
     joinDate || new Date(), ptkpStatus || 'TK/0']
  );
  await writeAuditLog(req.auth, 'ADD_EMPLOYEE', `Mendaftarkan karyawan baru ${name} dengan ID ${id}`);

  const warnings = [];
  if (isBelowMinimumWage(Number(baseSalary), REGIONAL_MINIMUM_WAGE)) {
    warnings.push(
      `Gaji pokok di bawah upah minimum acuan (Rp ${REGIONAL_MINIMUM_WAGE.toLocaleString('id-ID')}). Verifikasi dengan UMR/UMK daerah karyawan.`
    );
  }
  res.status(201).json({ ...toEmployeeDTO(result.rows[0]), warnings });
}));

employeesRouter.put('/:id', requireRole('admin'), wrapAsync(async (req, res) => {
  const { name, email, role, department, baseSalary, bankName, bankAccount, ptkpStatus } = req.body || {};
  if (ptkpStatus && !VALID_PTKP.has(ptkpStatus)) {
    return res.status(400).json({ error: `Status PTKP tidak valid. Gunakan salah satu: ${[...VALID_PTKP].join(', ')}.` });
  }

  const result = await pool.query(
    `UPDATE employees SET name=$1, email=$2, role=$3, department=$4, base_salary=$5, bank_name=$6, bank_account=$7,
       ptkp_status = COALESCE($8, ptkp_status)
     WHERE id=$9 AND company_id=$10 RETURNING *`,
    [name, email || null, role, department, baseSalary, bankName || null, bankAccount || null, ptkpStatus || null,
     req.params.id, req.auth.companyId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Karyawan tidak ditemukan.' });
  await writeAuditLog(req.auth, 'EDIT_EMPLOYEE', `Memperbarui data profil karyawan ${name} (${req.params.id})`);
  res.json(toEmployeeDTO(result.rows[0]));
}));

employeesRouter.delete('/:id', requireRole('admin'), wrapAsync(async (req, res) => {
  const result = await pool.query('DELETE FROM employees WHERE id=$1 AND company_id=$2 RETURNING name', [
    req.params.id,
    req.auth.companyId,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Karyawan tidak ditemukan.' });
  await writeAuditLog(req.auth, 'DELETE_EMPLOYEE', `Menghapus karyawan ${result.rows[0].name} dari sistem.`);
  res.status(204).end();
}));

// One-off THR (Tunjangan Hari Raya) estimate — not stored as a payroll slip, since
// THR is a yearly allowance rather than a monthly pay cycle. Admin-only, read-only.
employeesRouter.get('/:id/thr', requireRole('admin'), wrapAsync(async (req, res) => {
  const emp = await pool.query('SELECT name, base_salary, join_date FROM employees WHERE id=$1 AND company_id=$2', [
    req.params.id,
    req.auth.companyId,
  ]);
  if (emp.rows.length === 0) return res.status(404).json({ error: 'Karyawan tidak ditemukan.' });

  const row = emp.rows[0];
  const amount = calculateThr(Number(row.base_salary), row.join_date);
  res.json({ employeeName: row.name, amount });
}));
