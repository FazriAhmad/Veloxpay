import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set in server/.env');

export const MIN_PASSWORD_LENGTH = 8;
export const isPasswordTooShort = (password) => !password || password.length < MIN_PASSWORD_LENGTH;

export function signToken(user) {
  return jwt.sign(
    { userId: user.id, companyId: user.company_id, role: user.role, employeeId: user.employee_id, name: user.name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Tidak terautentikasi.' });

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesi tidak valid atau kedaluwarsa.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses untuk aksi ini.' });
    }
    next();
  };
}
