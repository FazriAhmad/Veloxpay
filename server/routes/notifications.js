import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { toNotificationDTO } from '../mappers.js';
import { wrapAsync } from '../wrapAsync.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

// Real delivery log — an employee sees only notifications about their own slips,
// same scoping rule as everything else keyed off employee_id.
notificationsRouter.get('/', wrapAsync(async (req, res) => {
  const scopedToSelf = req.auth.role === 'employee';
  const result = scopedToSelf
    ? await pool.query(
        `SELECT * FROM notification_log
         WHERE company_id = $1 AND recipient_employee_id = $2
         ORDER BY created_at DESC LIMIT 100`,
        [req.auth.companyId, req.auth.employeeId]
      )
    : await pool.query(
        'SELECT * FROM notification_log WHERE company_id = $1 ORDER BY created_at DESC LIMIT 100',
        [req.auth.companyId]
      );
  res.json(result.rows.map(toNotificationDTO));
}));
