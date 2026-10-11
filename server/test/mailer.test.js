import test from 'node:test';
import assert from 'node:assert/strict';
import { sendPayslipEmail } from '../mailer.js';

test('mailer: no recipient email is honestly skipped, not faked as sent', async () => {
  const result = await sendPayslipEmail({ to: '', subject: 'x', html: '<p>x</p>' });
  assert.equal(result.status, 'skipped');
});

test('mailer: without SMTP_HOST configured, result is skipped rather than sent', async () => {
  // This test only holds in an environment with no SMTP_HOST set (the default for a
  // fresh checkout before .env is filled in) — which is exactly the case it guards.
  if (process.env.SMTP_HOST) return;
  const result = await sendPayslipEmail({ to: 'someone@example.com', subject: 'x', html: '<p>x</p>' });
  assert.equal(result.status, 'skipped');
  assert.match(result.detail, /SMTP belum dikonfigurasi/);
});
