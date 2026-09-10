import { randomUUID } from 'crypto';
import { pool } from './db.js';

export async function writeAuditLog(auth, action, details) {
  await pool.query(
    `INSERT INTO audit_logs (id, company_id, user_id, actor_name, actor_role, action, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [`LOG-${randomUUID().slice(0, 8)}`, auth.companyId, auth.userId, auth.name || auth.userId, auth.role, action, details]
  );
}
