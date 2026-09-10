import nodemailer from 'nodemailer';
import 'dotenv/config';

// Real email delivery when SMTP is configured; an honest "skipped" result otherwise —
// never a fake "sent" for an email that never left the server. Set SMTP_HOST/PORT/
// USER/PASS and MAIL_FROM in server/.env to actually deliver.
function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

// Returns { status: 'sent'|'failed'|'skipped', detail }. Never throws — callers log
// this result and move on rather than letting an email problem break a payroll action.
export async function sendPayslipEmail({ to, subject, html, attachment }) {
  if (!to) return { status: 'skipped', detail: 'Karyawan tidak punya alamat email tercatat.' };

  const transport = getTransport();
  if (!transport) {
    return { status: 'skipped', detail: 'SMTP belum dikonfigurasi di server/.env (SMTP_HOST kosong).' };
  }

  try {
    const info = await transport.sendMail({
      from: process.env.MAIL_FROM || 'VeloxPay <no-reply@veloxpay.local>',
      to,
      subject,
      html,
      attachments: attachment ? [{ filename: attachment.filename, content: attachment.buffer }] : [],
    });
    return { status: 'sent', detail: `Terkirim via ${process.env.SMTP_HOST} (id: ${info.messageId}).` };
  } catch (err) {
    return { status: 'failed', detail: err.message };
  }
}
