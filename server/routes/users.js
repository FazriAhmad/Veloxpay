import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrapAsync } from '../wrapAsync.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

// Admin-only: create a login for an existing employee record.
usersRouter.post('/', requireRole('admin'), wrapAsync(async (req, res) => {
  const { employeeId, email, password } = req.body || {};
  if (!employeeId || !email || !password) {
    return res.status(400).json({ error: 'employeeId, email, dan password wajib diisi.' });
  }

  const emp = await pool.query('SELECT * FROM employees WHERE id = $1 AND company_id = $2', [
    employeeId,
    req.auth.companyId,
  ]);
  if (emp.rows.length === 0) return res.status(404).json({ error: 'Karyawan tidak ditemukan.' });

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) return res.status(409).json({ error: 'Email sudah terdaftar.' });

  const userId = `USR-${randomUUID().slice(0, 8)}`;
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (id, company_id, email, password_hash, name, role, employee_id)
     VALUES ($1, $2, $3, $4, $5, 'employee', $6)`,
    [userId, req.auth.companyId, email, passwordHash, emp.rows[0].name, employeeId]
  );

  res.status(201).json({ id: userId, email, employeeId, role: 'employee' });
}));

usersRouter.get('/', requireRole('admin'), wrapAsync(async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, role, employee_id FROM users WHERE company_id = $1 ORDER BY created_at',
    [req.auth.companyId]
  );
  res.json(result.rows);
}));
