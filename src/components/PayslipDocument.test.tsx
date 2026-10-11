import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PayslipDocument } from './PayslipDocument';
import { PayrollSlip } from '../lib/mockData';

const sampleSlip: PayrollSlip = {
  id: 'PAY-202609-TEST',
  employeeId: 'EMP-001',
  employeeName: 'Ahmad Subarjo',
  employeeRole: 'Senior Software Engineer',
  employeeDepartment: 'Engineering',
  month: '2026-09',
  baseSalary: 15_500_000,
  bankName: 'BCA',
  bankAccount: '8012345678',
  allowances: [{ name: 'Tunjangan Makan', amount: 500_000 }],
  deductions: [
    { name: 'PPh 21 (estimasi)', amount: 535_000 },
    { name: 'BPJS Kesehatan (1%)', amount: 155_000 },
  ],
  overtimePay: 700_000,
  overtimeHours: 12,
  grossSalary: 16_700_000,
  netSalary: 16_010_000,
  status: 'Paid',
  generatedAt: '2026-09-10T11:55:59.382Z',
  approvedBy: 'Dewi Lestari',
};

describe('PayslipDocument', () => {
  it('renders the employee, statutory deduction lines, and net salary', () => {
    render(<PayslipDocument slip={sampleSlip} />);

    expect(screen.getByText('Ahmad Subarjo')).toBeInTheDocument();
    expect(screen.getByText('PPh 21 (estimasi)')).toBeInTheDocument();
    expect(screen.getByText('BPJS Kesehatan (1%)')).toBeInTheDocument();
    expect(screen.getAllByText('SUDAH DIBAYAR', { exact: false }).length).toBeGreaterThan(0);
    expect(document.body.textContent).toMatch(/Rp.16\.010\.000/);
  });

  it('never implies VeloxPay itself processed a transfer', () => {
    render(<PayslipDocument slip={sampleSlip} />);
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toMatch(/ditransfer oleh veloxpay/i);
    expect(bodyText).toMatch(/konfirmasi manual/i);
  });

  it('shows "DRAF" for a slip that has not been approved or paid yet', () => {
    render(<PayslipDocument slip={{ ...sampleSlip, status: 'Draft' }} />);
    expect(screen.getAllByText('DRAF', { exact: false }).length).toBeGreaterThan(0);
  });
});
