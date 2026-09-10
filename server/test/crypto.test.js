import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

// Use a throwaway key for this test run so it doesn't depend on server/.env being filled in.
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
const { encryptField, decryptField } = await import('../crypto.js');

test('encryptField -> decryptField round-trips a bank account number', () => {
  const original = '8012345678';
  const encrypted = encryptField(original);
  assert.notEqual(encrypted, original, 'ciphertext should not equal the plaintext');
  assert.equal(decryptField(encrypted), original);
});

test('encryptField produces different ciphertext for the same input each time (random IV)', () => {
  const a = encryptField('8012345678');
  const b = encryptField('8012345678');
  assert.notEqual(a, b);
});

test('decryptField fails open on legacy plaintext instead of throwing', () => {
  assert.equal(decryptField('8012345678'), '8012345678');
});

test('null/undefined pass through both directions', () => {
  assert.equal(encryptField(null), null);
  assert.equal(decryptField(null), null);
});
