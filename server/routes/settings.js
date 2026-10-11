import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { writeAuditLog } from '../auditLog.js';
import { wrapAsync } from '../wrapAsync.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

const read = async (companyId) =>
  (await pool.query('SELECT require_separate_approver FROM companies WHERE id=$1', [companyId])).rows[0];

settingsRouter.get('/', wrapAsync(async (req, res) => {
  const row = await read(req.auth.companyId);
  res.json({ requireSeparateApprover: !!row?.require_separate_approver });
}));

settingsRouter.put('/', requireRole('admin'), wrapAsync(async (req, res) => {
  const { requireSeparateApprover } = req.body || {};
  if (typeof requireSeparateApprover !== 'boolean') {
    return res.status(400).json({ error: 'requireSeparateApprover harus berupa boolean.' });
  }
  await pool.query('UPDATE companies SET require_separate_approver=$1 WHERE id=$2', [requireSeparateApprover, req.auth.companyId]);
  await writeAuditLog(
    req.auth,
    'UPDATE_SETTINGS',
    `Pemisahan pembuat dan penyetuju slip ${requireSeparateApprover ? 'diaktifkan' : 'dimatikan'}.`
  );
  res.json({ requireSeparateApprover });
}));
