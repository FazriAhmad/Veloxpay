import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { employeesRouter } from './routes/employees.js';
import { componentsRouter } from './routes/components.js';
import { attendanceRouter } from './routes/attendance.js';
import { slipsRouter } from './routes/slips.js';
import { auditLogsRouter } from './routes/auditLogs.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/employees', employeesRouter);
app.use('/components', componentsRouter);
app.use('/attendance', attendanceRouter);
app.use('/slips', slipsRouter);
app.use('/audit-logs', auditLogsRouter);

// Central error handler — keeps DB/validation errors from leaking stack traces to clients.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

const port = process.env.PORT || 4001;
app.listen(port, () => console.log(`VeloxPay API listening on :${port}`));
