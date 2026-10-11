import { MONTH_PATTERN, parseOvertimeHours } from './slipRules.js';

const DAY_FIELDS = [['present', 'Hadir'], ['sick', 'Sakit'], ['leave', 'Cuti'], ['alpha', 'Alpha']];

// Validates what an employee submits for one month. Returns { value } or { error }.
// Only the listed fields are kept, so nothing else in the body reaches the database.
export function parseAttendanceRequest(body) {
  const { month, note } = body || {};
  if (typeof month !== 'string' || !MONTH_PATTERN.test(month)) return { error: 'Periode harus berformat YYYY-MM.' };

  const value = { month };
  let totalDays = 0;
  for (const [key, label] of DAY_FIELDS) {
    const n = body[key] ?? 0;
    if (!Number.isInteger(n) || n < 0 || n > 31) return { error: `${label} harus berupa bilangan bulat 0-31.` };
    value[key] = n;
    totalDays += n;
  }
  if (totalDays > 31) return { error: 'Total hari melebihi 31.' };

  const overtime = parseOvertimeHours(body.overtimeHours ?? 0);
  if (overtime.error) return { error: overtime.error };
  value.overtimeHours = overtime.hours;

  if (note != null && (typeof note !== 'string' || note.length > 500)) return { error: 'Catatan maksimal 500 karakter.' };
  value.note = note?.trim() || null;
  return { value };
}
