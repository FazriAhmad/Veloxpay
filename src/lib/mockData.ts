// Shared domain types. Employee/attendance/component/slip/audit/notification data all
// come from the API (see api.ts); only the scheduler config below is still a local
// mock — real cron-based scheduling is a Phase 6 backlog item, not Phase 3's scope
// (which covers documents/notifications for actions already triggered by an admin).

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
  // PTKP status per DJP (TK/0..3 = single with N dependents, K/0..3 = married with
  // N dependents) — drives the PPh 21 non-taxable income threshold.
  ptkpStatus: string;
}

export const PTKP_STATUSES = ['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'] as const;

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

// A real record of one email delivery attempt — status is honest ('skipped' when
// SMTP isn't configured, 'failed' on an actual send error), never a fabricated
// message body pretending to be received mail.
export interface NotificationLogEntry {
  id: string;
  slipId?: string;
  to: string;
  subject: string;
  status: 'sent' | 'failed' | 'skipped';
  detail: string;
  sentAt: string;
}

export const INITIAL_SCHEDULED_CONFIG: ScheduledConfig = {
  isEnabled: true,
  dayOfMonth: 25,
  time: "00:00",
  autoApprove: false,
  notifyEmail: true
};
