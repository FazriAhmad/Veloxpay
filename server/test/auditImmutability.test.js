import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../db.js';

// Checks the rules exist via the catalog rather than inserting a real row and trying
// to mutate/delete it: a genuine no-op DELETE would leave a permanent, un-removable
// row in the database — audit_logs is immutable by design, including for tests.
test('audit_logs has DB-level rules blocking UPDATE and DELETE', async () => {
  const { rows } = await pool.query(
    `SELECT rulename FROM pg_rules WHERE tablename = 'audit_logs' ORDER BY rulename`
  );
  const ruleNames = rows.map((r) => r.rulename);
  assert.ok(ruleNames.includes('audit_logs_no_update'), 'expected audit_logs_no_update rule');
  assert.ok(ruleNames.includes('audit_logs_no_delete'), 'expected audit_logs_no_delete rule');
});

test.after(() => pool.end());
