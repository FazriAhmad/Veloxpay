import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { signToken, requireAuth, isPasswordTooShort, MIN_PASSWORD_LENGTH } from '../auth.js';
import { wrapAsync } from '../wrapAsync.js';

export const authRouter = Router();

// Self-serve signup: creates a new company plus its first admin user.
// Employee logins are created by that admin afterwards (see routes/users.js).
authRouter.post('/register', wrapAsync(async (req, res) => {
  const { companyName, name, email, password } = req.body || {};
  if (!companyName || !name || !email || !password) {
    return res.status(400).json({ error: 'companyName, name, email, dan password wajib diisi.' });
  }
  if (isPasswordTooShort(password)) {
    return res.status(400).json({ error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.` });
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Email sudah terdaftar.' });
  }

  const companyId = `CO-${randomUUID().slice(0, 8)}`;
  const userId = `USR-${randomUUID().slice(0, 8)}`;
  const passwordHash = await bcrypt.hash(password, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO companies (id, name) VALUES ($1, $2)', [companyId, companyName]);
    await client.query(
      `INSERT INTO users (id, company_id, email, password_hash, name, role)
       VALUES ($1, $2, $3, $4, $5, 'admin')`,
      [userId, companyId, email, passwordHash, name]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const user = { id: userId, company_id: companyId, role: 'admin', employee_id: null, name };
  res.status(201).json({ token: signToken(user), user: { id: userId, companyId, name, email, role: 'admin' } });
}));

authRouter.post('/login', wrapAsync(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi.' });

  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Email atau password salah.' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Email atau password salah.' });

  res.json({
    token: signToken(user),
    user: {
      id: user.id,
      companyId: user.company_id,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeId: user.employee_id,
    },
  });
}));

authRouter.get('/me', requireAuth, wrapAsync(async (req, res) => {
  const result = await pool.query('SELECT id, company_id, name, email, role, employee_id FROM users WHERE id = $1', [
    req.auth.userId,
  ]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  res.json({
    id: user.id,
    companyId: user.company_id,
    name: user.name,
    email: user.email,
    role: user.role,
    employeeId: user.employee_id,
  });
}));
