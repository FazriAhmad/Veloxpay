import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { requireAuth, requireRole, isPasswordTooShort, MIN_PASSWORD_LENGTH } from '../auth.js';
import { wrapAsync } from '../wrapAsync.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

const STAFF_ROLES = ['finance', 'approver'];

// Admin-only: create a login. An employee login links to an existing employee record;
// finance/approver logins are staff accounts and need a name instead.
usersRouter.post('/', requireRole('admin'), wrapAsync(async (req, res) => {
  const { employeeId, email, password, name, role = 'employee' } = req.body || {};
  if (role !== 'employee' && !STAFF_ROLES.includes(role)) {
    return res.status(400).json({ error: `role harus salah satu dari: employee, ${STAFF_ROLES.join(', ')}.` });
  }
  if (!email || !password || (role === 'employee' ? !employeeId : !name)) {
    return res.status(400).json({
      error: role === 'employee' ? 'employeeId, email, dan password wajib diisi.' : 'name, email, dan password wajib diisi.',
    });
  }
  if (isPasswordTooShort(password)) {
    return res.status(400).json({ error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.` });
  }

  let displayName = name;
  if (role === 'employee') {
    const emp = await pool.query('SELECT * FROM employees WHERE id = $1 AND company_id = $2', [
      employeeId,
      req.auth.companyId,
    ]);
    if (emp.rows.length === 0) return res.status(404).json({ error: 'Karyawan tidak ditemukan.' });
    displayName = emp.rows[0].name;
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) return res.status(409).json({ error: 'Email sudah terdaftar.' });

  const userId = `USR-${randomUUID().slice(0, 8)}`;
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (id, company_id, email, password_hash, name, role, employee_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, req.auth.companyId, email, passwordHash, displayName, role, role === 'employee' ? employeeId : null]
  );

  res.status(201).json({ id: userId, email, employeeId: role === 'employee' ? employeeId : undefined, role });
}));

usersRouter.get('/', requireRole('admin'), wrapAsync(async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, role, employee_id FROM users WHERE company_id = $1 ORDER BY created_at',
    [req.auth.companyId]
  );
  res.json(result.rows);
}));
