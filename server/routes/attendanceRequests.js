import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { writeAuditLog } from '../auditLog.js';
import { wrapAsync } from '../wrapAsync.js';
import { parseAttendanceRequest } from '../attendanceRules.js';
import { notify, esc } from '../notify.js';

export const attendanceRequestsRouter = Router();
attendanceRequestsRouter.use(requireAuth);

const toDTO = (r) => ({
  id: r.id,
  employeeId: r.employee_id,
  employeeName: r.employee_name,
  month: r.month,
  present: r.present,
  sick: r.sick,
  leave: r.leave,
  alpha: r.alpha,
  overtimeHours: Number(r.overtime_hours),
  note: r.note || undefined,
  status: r.status,
  decidedBy: r.decided_by || undefined,
  decisionNote: r.decision_note || undefined,
  createdAt: r.created_at.toISOString(),
});

const SELECT = `SELECT r.*, e.name AS employee_name FROM attendance_requests r JOIN employees e ON e.id = r.employee_id`;

// Employees see their own requests; staff see the whole company's.
attendanceRequestsRouter.get('/', wrapAsync(async (req, res) => {
  const own = req.auth.role === 'employee';
  const result = await pool.query(
    `${SELECT} WHERE r.company_id = $1 ${own ? 'AND r.employee_id = $2' : ''} ORDER BY r.created_at DESC LIMIT 200`,
    own ? [req.auth.companyId, req.auth.employeeId] : [req.auth.companyId]
  );
  res.json(result.rows.map(toDTO));
}));

attendanceRequestsRouter.post('/', requireRole('employee'), wrapAsync(async (req, res) => {
  if (!req.auth.employeeId) return res.status(403).json({ error: 'Akun ini tidak terhubung ke data karyawan.' });
  const { value, error } = parseAttendanceRequest(req.body);
  if (error) return res.status(400).json({ error });

  let created;
  try {
    created = await pool.query(
      `INSERT INTO attendance_requests (id, company_id, employee_id, month, present, sick, leave, alpha, overtime_hours, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [`REQ-${randomUUID().slice(0, 8)}`, req.auth.companyId, req.auth.employeeId, value.month, value.present,
       value.sick, value.leave, value.alpha, value.overtimeHours, value.note]
    );
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Pengajuan untuk periode ini masih menunggu keputusan.' });
    throw err;
  }
  await writeAuditLog(req.auth, 'REQUEST_ATTENDANCE', `Mengajukan kehadiran periode ${value.month} (lembur ${value.overtimeHours} jam)`);
  const row = await pool.query(`${SELECT} WHERE r.id = $1`, [created.rows[0].id]);
  await notify({
    companyId: req.auth.companyId, to: { roles: ['approver', 'admin'] }, kind: 'attendance_needs_approval',
    subject: `[VeloxPay] Pengajuan absensi menunggu keputusan: ${row.rows[0].employee_name} ${value.month}`,
    html: `<p><strong>${esc(row.rows[0].employee_name)}</strong> mengajukan kehadiran periode ${esc(value.month)}: hadir ${value.present}, sakit ${value.sick}, cuti ${value.leave}, alpha ${value.alpha}, lembur ${value.overtimeHours} jam.</p><p>Setujui atau tolak di VeloxPay (Persetujuan).</p>`,
  });
  res.status(201).json(toDTO(row.rows[0]));
}));

// An employee can withdraw their own request while it is still open.
attendanceRequestsRouter.delete('/:id', requireRole('employee'), wrapAsync(async (req, res) => {
  const result = await pool.query(
    `DELETE FROM attendance_requests WHERE id=$1 AND company_id=$2 AND employee_id=$3 AND status='Pending' RETURNING month`,
    [req.params.id, req.auth.companyId, req.auth.employeeId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Pengajuan tidak ditemukan atau sudah diputuskan.' });
  await writeAuditLog(req.auth, 'CANCEL_ATTENDANCE_REQUEST', `Membatalkan pengajuan kehadiran periode ${result.rows[0].month}`);
  res.status(204).end();
}));

attendanceRequestsRouter.patch('/:id/decision', requireRole('admin', 'approver'), wrapAsync(async (req, res) => {
  const { decision, note } = req.body || {};
  if (decision !== 'Approved' && decision !== 'Rejected') {
    return res.status(400).json({ error: 'decision harus Approved atau Rejected.' });
  }
  if (note != null && (typeof note !== 'string' || note.length > 500)) {
    return res.status(400).json({ error: 'Catatan maksimal 500 karakter.' });
  }

  // Deciding and applying happen in one transaction: an approval that fails to write the
  // attendance row is rolled back instead of leaving a request marked Approved with no effect.
  const client = await pool.connect();
  let decided;
  try {
    await client.query('BEGIN');
    decided = await client.query(
      `UPDATE attendance_requests SET status=$1, decided_by=$2, decision_note=$3, decided_at=now()
       WHERE id=$4 AND company_id=$5 AND status='Pending' RETURNING *`,
      [decision, req.auth.name, note?.trim() || null, req.params.id, req.auth.companyId]
    );
    if (decided.rows.length > 0 && decision === 'Approved') {
      const r = decided.rows[0];
      await client.query(
        `INSERT INTO attendance (employee_id, month, present, sick, leave, alpha, overtime_hours)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (employee_id, month)
         DO UPDATE SET present=$3, sick=$4, leave=$5, alpha=$6, overtime_hours=$7`,
        [r.employee_id, r.month, r.present, r.sick, r.leave, r.alpha, r.overtime_hours]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (decided.rows.length === 0) {
    return res.status(409).json({ error: 'Pengajuan tidak ditemukan atau sudah diputuskan.' });
  }
  const r = decided.rows[0];
  await writeAuditLog(
    req.auth,
    decision === 'Approved' ? 'APPROVE_ATTENDANCE' : 'REJECT_ATTENDANCE',
    `${decision === 'Approved' ? 'Menyetujui' : 'Menolak'} pengajuan kehadiran ${r.id} periode ${r.month}`
  );
  const row = await pool.query(`${SELECT} WHERE r.id = $1`, [r.id]);
  await notify({
    companyId: req.auth.companyId, to: { employeeId: r.employee_id }, kind: 'attendance_decided',
    subject: `[VeloxPay] Pengajuan absensi ${r.month} ${decision === 'Approved' ? 'disetujui' : 'ditolak'}`,
    html: `<p>Halo ${esc(row.rows[0].employee_name)},</p><p>Pengajuan absensi periode ${esc(r.month)} ${decision === 'Approved' ? 'disetujui' : 'ditolak'} oleh ${esc(req.auth.name)}.${r.decision_note ? ` Catatan: ${esc(r.decision_note)}` : ''}</p>`,
  });
  res.json(toDTO(row.rows[0]));
}));
