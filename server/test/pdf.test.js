import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPayslipPdf } from '../pdf.js';

const SAMPLE_SLIP = {
  id: 'PAY-TEST-0001',
  employeeId: 'EMP-001',
  employeeName: 'Ahmad Subarjo',
  employeeRole: 'Senior Software Engineer',
  employeeDepartment: 'Engineering',
  month: '2026-09',
  baseSalary: 15500000,
  bankName: 'BCA',
  bankAccount: '8012345678',
  allowances: [{ name: 'Tunjangan Makan', amount: 500000 }],
  deductions: [{ name: 'PPh 21 (estimasi)', amount: 400000 }],
  overtimePay: 0,
  overtimeHours: 0,
  grossSalary: 16000000,
  netSalary: 15600000,
  status: 'Paid',
  generatedAt: new Date().toISOString(),
  approvedBy: 'Dewi Lestari',
};

test('renderPayslipPdf produces a non-empty, valid PDF buffer', async () => {
  const buffer = await renderPayslipPdf(SAMPLE_SLIP);
  assert.ok(buffer.length > 500, 'PDF should have real content, not just headers');
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
});

test('renderPayslipPdf handles a slip with no deductions or allowances', async () => {
  const buffer = await renderPayslipPdf({ ...SAMPLE_SLIP, allowances: [], deductions: [] });
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
});
