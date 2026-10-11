import { randomUUID } from 'crypto';
import { pool } from './db.js';
import { sendPayslipEmail } from './mailer.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Resolves who should hear about something and sends each of them one email, logging every attempt
// in notification_log (including 'skipped' when SMTP is not configured). Never throws: an email
// problem must not undo the payroll action that triggered it.
//
//   to.roles       -> every user in the company with one of these roles
//   to.userIds     -> those users
//   to.employeeId  -> that employee, at the address on their employee record; the log row is then
//                     visible to that employee (recipient_employee_id)
export async function notify({ companyId, to, subject, html, slipId = null, kind }) {
  try {
    const recipients = new Map(); // email (lowercase) -> true; one mail per address
    if (to.roles?.length) {
      const r = await pool.query('SELECT email FROM users WHERE company_id=$1 AND role = ANY($2)', [companyId, to.roles]);
      r.rows.forEach((u) => recipients.set(u.email.toLowerCase(), null));
    }
    if (to.userIds?.length) {
      const r = await pool.query('SELECT email FROM users WHERE company_id=$1 AND id = ANY($2)', [companyId, to.userIds]);
      r.rows.forEach((u) => recipients.set(u.email.toLowerCase(), null));
    }
    if (to.employeeId) {
      const r = await pool.query('SELECT email FROM employees WHERE id=$1 AND company_id=$2', [to.employeeId, companyId]);
      recipients.set(r.rows[0]?.email?.toLowerCase() ?? '', to.employeeId);
    }

    await Promise.all(
      [...recipients].map(async ([email, recipientEmployeeId]) => {
        const result = await sendPayslipEmail({ to: email || undefined, subject, html });
        await pool.query(
          `INSERT INTO notification_log (id, company_id, slip_id, recipient_employee_id, kind, to_email, subject, status, detail)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [`NOTIF-${randomUUID().slice(0, 8)}`, companyId, slipId, recipientEmployeeId, kind, email || '(tidak ada email)',
           subject, result.status, result.detail]
        );
      })
    );
  } catch (err) {
    console.error('notify failed:', err.message);
  }
}
