import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAttendanceRequest } from '../attendanceRules.js';

test('a valid request keeps only the known fields', () => {
  const { value, error } = parseAttendanceRequest({
    month: '2028-07', present: 20, sick: 1, leave: 1, alpha: 0, overtimeHours: 6.5, note: ' lembur proyek ', employeeId: 'EMP-X', status: 'Approved',
  });
  assert.equal(error, undefined);
  assert.deepEqual(value, { month: '2028-07', present: 20, sick: 1, leave: 1, alpha: 0, overtimeHours: 6.5, note: 'lembur proyek' });
});

test('missing numbers default to zero', () => {
  assert.deepEqual(parseAttendanceRequest({ month: '2028-07' }).value,
    { month: '2028-07', present: 0, sick: 0, leave: 0, alpha: 0, overtimeHours: 0, note: null });
});

test('bad input is rejected', () => {
  const bad = [
    {}, { month: '2028-13' }, { month: '2028-07', present: -1 }, { month: '2028-07', present: 1.5 },
    { month: '2028-07', present: '20' }, { month: '2028-07', present: 32 },
    { month: '2028-07', present: 20, sick: 10, leave: 5 },       // 35 days
    { month: '2028-07', overtimeHours: -1 }, { month: '2028-07', overtimeHours: 745 }, { month: '2028-07', overtimeHours: 'NaN' },
    { month: '2028-07', note: 'x'.repeat(501) }, { month: '2028-07', note: 5 },
  ];
  for (const body of bad) assert.ok(parseAttendanceRequest(body).error, JSON.stringify(body));
});
