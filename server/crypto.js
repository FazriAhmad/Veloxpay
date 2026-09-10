import crypto from 'crypto';
import 'dotenv/config';

// AES-256-GCM field-level encryption for sensitive columns (bank account numbers).
// Ciphertext is stored as "iv:authTag:data" (all hex) so it's still a plain TEXT column.
const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY is not set in server/.env');
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  return key;
}

export function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptField(ciphertext) {
  if (ciphertext === null || ciphertext === undefined) return null;
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return ciphertext; // pre-encryption legacy plaintext row — fail open to avoid data loss
  const [ivHex, authTagHex, dataHex] = parts;
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return ciphertext; // couldn't decrypt (wrong key or corrupted) — surface raw value rather than throwing
  }
}
