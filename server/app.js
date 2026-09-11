import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import 'dotenv/config';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { employeesRouter } from './routes/employees.js';
import { componentsRouter } from './routes/components.js';
import { attendanceRouter } from './routes/attendance.js';
import { slipsRouter } from './routes/slips.js';
import { auditLogsRouter } from './routes/auditLogs.js';
import { notificationsRouter } from './routes/notifications.js';

// Exports the app without binding a port, so tests (see test/integration.test.js)
// can drive it directly through supertest instead of needing a running server.
export const app = express();

// Behind a real reverse proxy in production, trust its X-Forwarded-* headers so
// rate limiting and the HTTPS check below see the real client, not the proxy.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// Redirect plain HTTP to HTTPS in production. Skipped in dev, where there is no
// TLS-terminating proxy in front of the server and localhost has no cert anyway.
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
});

// Frontend and API run on different origins/ports in this setup (see CORS below),
// so the resource-policy header must allow cross-origin reads or the browser
// blocks the frontend's own fetch() calls despite valid CORS headers.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Origins allowed to call this API. Unset (the local-dev default) allows any
// origin; set ALLOWED_ORIGINS in any deployed environment.
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors(allowedOrigins ? { origin: allowedOrigins } : {}));

app.use(express.json());

// Request logging — quiet during tests, otherwise the only "monitoring" this app
// has today. Plug a real APM/error tracker (Sentry, etc.) into the error handler
// below when this goes to a real deployment; that needs an account this tool can't
// create on your behalf.
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Brute-force protection on the two endpoints that accept a password guess.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.' },
});
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);

// A generous ceiling on everything else — not brute-force-grade, just a backstop
// against a runaway client or script hammering the API.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/employees', employeesRouter);
app.use('/components', componentsRouter);
app.use('/attendance', attendanceRouter);
app.use('/slips', slipsRouter);
app.use('/audit-logs', auditLogsRouter);
app.use('/notifications', notificationsRouter);

// Central error handler — keeps DB/validation errors from leaking stack traces to clients.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});
