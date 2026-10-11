import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { toAuditLogDTO } from '../mappers.js';
import { wrapAsync } from '../wrapAsync.js';

export const auditLogsRouter = Router();
auditLogsRouter.use(requireAuth, requireRole('admin'));

// Read-only by design — audit entries are written internally by other routes, never edited or deleted via API.
auditLogsRouter.get('/', wrapAsync(async (req, res) => {
  const result = await pool.query('SELECT * FROM audit_logs WHERE company_id = $1 ORDER BY created_at DESC LIMIT 200', [
    req.auth.companyId,
  ]);
  res.json(result.rows.map(toAuditLogDTO));
}));
