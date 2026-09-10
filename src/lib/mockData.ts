// Shared domain types. Employee/attendance/component/slip/audit data now comes from the
// API (see api.ts); only the scheduler config and email inbox below are still local mocks,
// pending real scheduling and email delivery in Phase 3.

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  baseSalary: number;
  bankName: string;
  bankAccount: string;
  joinDate: string;
}

export interface Attendance {
  employeeId: string;
  month: string; // YYYY-MM (e.g., "2026-09")
  present: number;
  sick: number;
  leave: number;
  alpha: number;
  overtimeHours: number;
}

export interface SalaryComponent {
  id: string;
  name: string;
  type: 'allowance' | 'deduction';
  amountType: 'fixed' | 'percentage';
  value: number;
  description: string;
  isEditable: boolean;
}

export interface PayrollSlip {
  id: string; // e.g., PAY-202609-001
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  employeeDepartment: string;
  month: string; // YYYY-MM
  baseSalary: number;
  bankName: string;
  bankAccount: string;
  allowances: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
  overtimePay: number;
  overtimeHours: number;
  grossSalary: number;
  netSalary: number;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Paid';
  paymentDate?: string;
  generatedAt: string;
  approvedBy?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  details: string;
  ipAddress: string;
}

export interface ScheduledConfig {
  isEnabled: boolean;
  dayOfMonth: number;
  time: string;
  autoApprove: boolean;
  notifyEmail: boolean;
}

export interface SimulatedEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  isRead: boolean;
  pdfId?: string;
}


export const INITIAL_SCHEDULED_CONFIG: ScheduledConfig = {
  isEnabled: true,
  dayOfMonth: 25,
  time: "00:00",
  autoApprove: false,
  notifyEmail: true
};

export const INITIAL_EMAILS: SimulatedEmail[] = [
  {
    id: "EM-001",
    to: "ahmad.subarjo@veloxpay.co.id",
    subject: "Slip Gaji Digital VeloxPay - Agustus 2026",
    body: "Halo Ahmad Subarjo,\n\nSlip gaji Anda untuk periode Agustus 2026 telah terbit. Silakan login ke portal VeloxPay Anda untuk melihat rincian lengkap atau mengunduh dokumen PDF.\n\nDetail Singkat:\n- Gaji Pokok: IDR 15,500,000\n- Take Home Pay: IDR 16,790,000\n\nTerima kasih,\nVeloxPay Automated System",
    sentAt: "2026-08-25T00:10:00.000Z",
    isRead: false,
    pdfId: "PAY-202608-001"
  },
  {
    id: "EM-002",
    to: "siti.rahma@veloxpay.co.id",
    subject: "Slip Gaji Digital VeloxPay - Agustus 2026",
    body: "Halo Siti Rahmawati,\n\nSlip gaji Anda untuk periode Agustus 2026 telah terbit. Silakan login ke portal VeloxPay Anda untuk melihat rincian lengkap atau mengunduh dokumen PDF.\n\nDetail Singkat:\n- Gaji Pokok: IDR 11,000,000\n- Take Home Pay: IDR 11,785,000\n\nTerima kasih,\nVeloxPay Automated System",
    sentAt: "2026-08-25T00:10:30.000Z",
    isRead: true,
    pdfId: "PAY-202608-002"
  }
];
