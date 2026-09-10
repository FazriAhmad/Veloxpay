// One-off backfill: encrypts any bank_account values written before field-level
// encryption existed. Safe to re-run — already-encrypted values (containing the
// "iv:authTag:data" hex format) are left alone.
import { pool } from './db.js';
import { encryptField } from './crypto.js';

const isEncrypted = (v) => typeof v === 'string' && /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/.test(v);

async function backfill(table) {
  const { rows } = await pool.query(`SELECT id, bank_account FROM ${table} WHERE bank_account IS NOT NULL`);
  let updated = 0;
  for (const row of rows) {
    if (isEncrypted(row.bank_account)) continue;
    await pool.query(`UPDATE ${table} SET bank_account = $1 WHERE id = $2`, [
      encryptField(row.bank_account),
      row.id,
    ]);
    updated++;
  }
  console.log(`${table}: encrypted ${updated} of ${rows.length} row(s).`);
}

async function main() {
  await backfill('employees');
  await backfill('payroll_slips');
  await pool.end();
}

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
