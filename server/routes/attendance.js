import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { toAttendanceDTO } from '../mappers.js';
import { writeAuditLog } from '../auditLog.js';
import { wrapAsync } from '../wrapAsync.js';

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth);

attendanceRouter.get('/', wrapAsync(async (req, res) => {
  const scopedToSelf = req.auth.role === 'employee';
  const result = scopedToSelf
    ? await pool.query(
        `SELECT a.* FROM attendance a JOIN employees e ON e.id = a.employee_id
         WHERE e.company_id = $1 AND a.employee_id = $2`,
        [req.auth.companyId, req.auth.employeeId]
      )
    : await pool.query(
        `SELECT a.* FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE e.company_id = $1`,
        [req.auth.companyId]
      );
  res.json(result.rows.map(toAttendanceDTO));
}));

// Upsert one employee's attendance for a given month.
attendanceRouter.put('/:employeeId/:month', requireRole('admin'), wrapAsync(async (req, res) => {
  const { present = 0, sick = 0, leave = 0, alpha = 0, overtimeHours = 0 } = req.body || {};
  const { employeeId, month } = req.params;

  const emp = await pool.query('SELECT name FROM employees WHERE id=$1 AND company_id=$2', [
    employeeId,
    req.auth.companyId,
  ]);
  if (emp.rows.length === 0) return res.status(404).json({ error: 'Karyawan tidak ditemukan.' });

  const result = await pool.query(
    `INSERT INTO attendance (employee_id, month, present, sick, leave, alpha, overtime_hours)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (employee_id, month)
     DO UPDATE SET present=$3, sick=$4, leave=$5, alpha=$6, overtime_hours=$7
     RETURNING *`,
    [employeeId, month, present, sick, leave, alpha, overtimeHours]
  );
  await writeAuditLog(
    req.auth,
    'UPDATE_ATTENDANCE',
    `Memperbarui data kehadiran bulanan ${emp.rows[0].name} periode ${month}`
  );
  res.json(toAttendanceDTO(result.rows[0]));
}));
