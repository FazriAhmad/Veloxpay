// Validation and state rules for payroll slips, kept free of Express and the
// database so they can be unit-tested directly (see test/slipRules.test.js).
//
// Everything here exists because routes/slips.js used to trust the request body for
// money: a non-numeric amount became NaN (which Postgres NUMERIC accepts), a
// negative one silently raised take-home pay, and any status could jump to any
// other, including Paid back to Draft.

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const MAX_AMOUNT = 100_000_000_000; // Rp 100 miliar — far past any real line item
const MAX_ITEMS = 50;
const MAX_NAME_LENGTH = 100;
const MAX_OVERTIME_HOURS = 744; // hours in a 31-day month

/**
 * Cleans a list of { name, amount } line items (allowances or deductions).
 * Returns { items } on success or { error } describing the first problem.
 * Only name and amount are kept: the list is stored as JSON, so anything else a
 * client attaches would be stored too.
 */
export function parseLineItems(list, label) {
  if (list === undefined || list === null) return { items: [] };
  if (!Array.isArray(list)) return { error: `${label} harus berupa daftar.` };
  if (list.length > MAX_ITEMS) return { error: `${label} maksimal ${MAX_ITEMS} item.` };

  const items = [];
  for (const [i, raw] of list.entries()) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (!name || name.length > MAX_NAME_LENGTH) {
      return { error: `${label} #${i + 1}: nama wajib diisi (maksimal ${MAX_NAME_LENGTH} karakter).` };
    }
    // Number('') is 0 and Number(null) is 0, so blank values are rejected up front
    // rather than being read as a valid zero.
    const amount =
      typeof raw.amount === 'number'
        ? raw.amount
        : typeof raw.amount === 'string' && raw.amount.trim() !== ''
          ? Number(raw.amount)
          : NaN;
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
      return { error: `${label} "${name}": nominal harus berupa angka antara 0 dan ${MAX_AMOUNT.toLocaleString('id-ID')}.` };
    }
    items.push({ name, amount });
  }
  return { items };
}

/** Overtime hours as a finite number in [0, 744], or { error }. */
export function parseOvertimeHours(value) {
  if (value === undefined || value === null || value === '') return { hours: 0 };
  const hours = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(hours) || hours < 0 || hours > MAX_OVERTIME_HOURS) {
    return { error: `Jam lembur harus berupa angka antara 0 dan ${MAX_OVERTIME_HOURS}.` };
  }
  return { hours };
}

// The payslip screen used base / 173 as the hourly rate with a flat 1.5x multiplier;
// computing it here from the employee's stored salary keeps the number the same while
// taking it out of the client's hands.
// ponytail: a flat 1.5x, as the UI always did. Indonesian overtime rules step up after
// the first hour (and differ on rest days), so replace this before relying on it for
// real payroll.
export const calculateOvertimePay = (baseSalary, hours) => Math.round(hours * (baseSalary / 173) * 1.5);

// Draft -> (Pending Approval) -> Approved -> Paid. Paid is final: it triggers the
// payslip email and records a payment date, and neither should be repeatable or
// undoable. An approval can still be withdrawn back to Draft before payment.
const TRANSITIONS = {
  Draft: ['Pending Approval', 'Approved'],
  'Pending Approval': ['Draft', 'Approved'],
  Approved: ['Draft', 'Paid'],
  Paid: [],
};

/** Trimmed text of at most `max` characters, or { error }. Empty becomes null unless `required`. */
export function parseText(value, { max, label, required = false }) {
  if (value === undefined || value === null || value === '') {
    return required ? { error: `${label} wajib diisi.` } : { text: null };
  }
  if (typeof value !== 'string') return { error: `${label} harus berupa teks.` };
  const text = value.trim();
  if (!text) return required ? { error: `${label} wajib diisi.` } : { text: null };
  if (text.length > max) return { error: `${label} maksimal ${max} karakter.` };
  return { text };
}

// Who may make a given move. Preparing (finance) and releasing (approver) are separate
// duties; admin can do both.
export const rolesForTransition = (from, to) => {
  if (to === 'Approved' || to === 'Paid' || from === 'Approved') return ['admin', 'approver'];
  if (to === 'Pending Approval') return ['admin', 'finance'];
  return ['admin', 'finance', 'approver'];
};

export const SLIP_STATUSES = Object.keys(TRANSITIONS);
export const canTransition = (from, to) => TRANSITIONS[from]?.includes(to) ?? false;

// A slip stops being a draft once it is approved; from then it is a financial record
// the audit log refers to, so it can no longer be deleted.
export const isDeletable = (status) => status === 'Draft' || status === 'Pending Approval';
