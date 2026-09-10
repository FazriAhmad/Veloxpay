import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { toEmployeeDTO } from '../mappers.js';
import { writeAuditLog } from '../auditLog.js';
import { wrapAsync } from '../wrapAsync.js';

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
  const { name, email, role, department, baseSalary, bankName, bankAccount, joinDate } = req.body || {};
  if (!name || !role || !department || !baseSalary) {
    return res.status(400).json({ error: 'name, role, department, dan baseSalary wajib diisi.' });
  }
  if (Number(baseSalary) <= 0) return res.status(400).json({ error: 'baseSalary harus lebih dari 0.' });

  const id = `EMP-${randomUUID().slice(0, 6).toUpperCase()}`;
  const result = await pool.query(
    `INSERT INTO employees (id, company_id, name, email, role, department, base_salary, bank_name, bank_account, join_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [id, req.auth.companyId, name, email || null, role, department, baseSalary, bankName || null, bankAccount || null, joinDate || new Date()]
  );
  await writeAuditLog(req.auth, 'ADD_EMPLOYEE', `Mendaftarkan karyawan baru ${name} dengan ID ${id}`);
  res.status(201).json(toEmployeeDTO(result.rows[0]));
}));

employeesRouter.put('/:id', requireRole('admin'), wrapAsync(async (req, res) => {
  const { name, email, role, department, baseSalary, bankName, bankAccount } = req.body || {};
  const result = await pool.query(
    `UPDATE employees SET name=$1, email=$2, role=$3, department=$4, base_salary=$5, bank_name=$6, bank_account=$7
     WHERE id=$8 AND company_id=$9 RETURNING *`,
    [name, email || null, role, department, baseSalary, bankName || null, bankAccount || null, req.params.id, req.auth.companyId]
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
