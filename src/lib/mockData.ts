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

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: "EMP-001",
    name: "Ahmad Subarjo",
    email: "ahmad.subarjo@veloxpay.co.id",
    role: "Senior Software Engineer",
    department: "Engineering",
    baseSalary: 15500000,
    bankName: "BCA",
    bankAccount: "8012345678",
    joinDate: "2023-01-15"
  },
  {
    id: "EMP-002",
    name: "Siti Rahmawati",
    email: "siti.rahma@veloxpay.co.id",
    role: "UI/UX Designer",
    department: "Product Design",
    baseSalary: 11000000,
    bankName: "Mandiri",
    bankAccount: "131002938475",
    joinDate: "2023-06-10"
  },
  {
    id: "EMP-003",
    name: "Budi Santoso",
    email: "budi.santoso@veloxpay.co.id",
    role: "HR Specialist",
    department: "Human Resources",
    baseSalary: 9500000,
    bankName: "BNI",
    bankAccount: "0482938472",
    joinDate: "2024-02-01"
  },
  {
    id: "EMP-004",
    name: "Dewi Lestari",
    email: "dewi.lestari@veloxpay.co.id",
    role: "Finance Lead",
    department: "Finance",
    baseSalary: 13500000,
    bankName: "BCA",
    bankAccount: "8019876543",
    joinDate: "2022-11-20"
  },
  {
    id: "EMP-005",
    name: "Rian Hidayat",
    email: "rian.hidayat@veloxpay.co.id",
    role: "DevOps Engineer",
    department: "Engineering",
    baseSalary: 14000000,
    bankName: "BRI",
    bankAccount: "03410293847",
    joinDate: "2024-05-12"
  }
];

export const INITIAL_ATTENDANCE: Attendance[] = [
  { employeeId: "EMP-001", month: "2026-09", present: 21, sick: 1, leave: 0, alpha: 0, overtimeHours: 12 },
  { employeeId: "EMP-002", month: "2026-09", present: 22, sick: 0, leave: 0, alpha: 0, overtimeHours: 5 },
  { employeeId: "EMP-003", month: "2026-09", present: 20, sick: 1, leave: 1, alpha: 0, overtimeHours: 0 },
  { employeeId: "EMP-004", month: "2026-09", present: 22, sick: 0, leave: 0, alpha: 0, overtimeHours: 2 },
  { employeeId: "EMP-005", month: "2026-09", present: 19, sick: 2, leave: 1, alpha: 0, overtimeHours: 18 }
];

export const INITIAL_COMPONENTS: SalaryComponent[] = [
  {
    id: "COMP-001",
    name: "Tunjangan Makan",
    type: "allowance",
    amountType: "fixed",
    value: 500000,
    description: "Tunjangan uang makan bulanan karyawan",
    isEditable: true
  },
  {
    id: "COMP-002",
    name: "Tunjangan Transportasi",
    type: "allowance",
    amountType: "fixed",
    value: 400000,
    description: "Tunjangan operasional transportasi",
    isEditable: true
  },
  {
    id: "COMP-003",
    name: "Tunjangan Kesehatan (BPJS)",
    type: "allowance",
    amountType: "fixed",
    value: 350000,
    description: "Subsidi jaminan kesehatan",
    isEditable: true
  },
  {
    id: "COMP-004",
    name: "Potongan BPJS Ketenagakerjaan",
    type: "deduction",
    amountType: "percentage",
    value: 2, // 2% of base salary
    description: "Iuran jaminan hari tua (JHT) karyawan",
    isEditable: true
  },
  {
    id: "COMP-005",
    name: "Potongan Pajak PPh 21",
    type: "deduction",
    amountType: "percentage",
    value: 5, // 5% of taxable income (simplified)
    description: "Pajak penghasilan pasal 21",
    isEditable: true
  },
  {
    id: "COMP-006",
    name: "Potongan Keterlambatan",
    type: "deduction",
    amountType: "fixed",
    value: 50000,
    description: "Denda keterlambatan kehadiran per hari absen/alpha",
    isEditable: true
  }
];

export const INITIAL_SLIPS: PayrollSlip[] = [
  {
    id: "PAY-202608-001",
    employeeId: "EMP-001",
    employeeName: "Ahmad Subarjo",
    employeeRole: "Senior Software Engineer",
    employeeDepartment: "Engineering",
    month: "2026-08",
    baseSalary: 15500000,
    bankName: "BCA",
    bankAccount: "8012345678",
    allowances: [
      { name: "Tunjangan Makan", amount: 500000 },
      { name: "Tunjangan Transportasi", amount: 400000 },
      { name: "Tunjangan Kesehatan (BPJS)", amount: 350000 }
    ],
    deductions: [
      { name: "Potongan BPJS Ketenagakerjaan", amount: 310000 }, // 2% of 15.5m
      { name: "Potongan Pajak PPh 21", amount: 775000 } // 5% of 15.5m
    ],
    overtimeHours: 10,
    overtimePay: 1125000, // 10 hours * (15.5m / 173 * 1.5) approx
    grossSalary: 17875000,
    netSalary: 16790000,
    status: "Paid",
    paymentDate: "2026-08-25",
    generatedAt: "2026-08-23T10:00:00.000Z",
    approvedBy: "Dewi Lestari"
  },
  {
    id: "PAY-202608-002",
    employeeId: "EMP-002",
    employeeName: "Siti Rahmawati",
    employeeRole: "UI/UX Designer",
    employeeDepartment: "Product Design",
    month: "2026-08",
    baseSalary: 11000000,
    bankName: "Mandiri",
    bankAccount: "131002938475",
    allowances: [
      { name: "Tunjangan Makan", amount: 500000 },
      { name: "Tunjangan Transportasi", amount: 400000 },
      { name: "Tunjangan Kesehatan (BPJS)", amount: 350000 }
    ],
    deductions: [
      { name: "Potongan BPJS Ketenagakerjaan", amount: 220000 },
      { name: "Potongan Pajak PPh 21", amount: 550000 }
    ],
    overtimeHours: 4,
    overtimePay: 305000,
    grossSalary: 12555000,
    netSalary: 11785000,
    status: "Paid",
    paymentDate: "2026-08-25",
    generatedAt: "2026-08-23T10:05:00.000Z",
    approvedBy: "Dewi Lestari"
  },
  {
    id: "PAY-202608-003",
    employeeId: "EMP-003",
    employeeName: "Budi Santoso",
    employeeRole: "HR Specialist",
    employeeDepartment: "Human Resources",
    month: "2026-08",
    baseSalary: 9500000,
    bankName: "BNI",
    bankAccount: "0482938472",
    allowances: [
      { name: "Tunjangan Makan", amount: 500000 },
      { name: "Tunjangan Transportasi", amount: 400000 }
    ],
    deductions: [
      { name: "Potongan BPJS Ketenagakerjaan", amount: 190000 },
      { name: "Potongan Pajak PPh 21", amount: 475000 }
    ],
    overtimeHours: 0,
    overtimePay: 0,
    grossSalary: 10400000,
    netSalary: 9735000,
    status: "Paid",
    paymentDate: "2026-08-25",
    generatedAt: "2026-08-23T10:10:00.000Z",
    approvedBy: "Dewi Lestari"
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: "LOG-001",
    timestamp: "2026-08-23T09:30:00.000Z",
    user: "Dewi Lestari",
    role: "Finance Lead",
    action: "SETUP_COMPONENTS",
    details: "Melakukan inisialisasi komponen gaji standar perusahaan.",
    ipAddress: "192.168.1.45"
  },
  {
    id: "LOG-002",
    timestamp: "2026-08-23T10:00:00.000Z",
    user: "Dewi Lestari",
    role: "Finance Lead",
    action: "GENERATE_PAYROLL",
    details: "Membuat draf payroll bulan Agustus 2026 untuk Ahmad Subarjo.",
    ipAddress: "192.168.1.45"
  },
  {
    id: "LOG-003",
    timestamp: "2026-08-24T08:15:00.000Z",
    user: "Dewi Lestari",
    role: "Finance Lead",
    action: "APPROVE_PAYROLL",
    details: "Menyetujui payroll bulan Agustus 2026 untuk seluruh karyawan.",
    ipAddress: "192.168.1.45"
  },
  {
    id: "LOG-004",
    timestamp: "2026-08-25T00:05:00.000Z",
    user: "SYSTEM",
    role: "Automated Scheduler",
    action: "DISBURSE_PAYMENT",
    details: "Mengirim dana payroll Agustus 2026 secara otomatis via VeloxTransfer.",
    ipAddress: "127.0.0.1"
  },
  {
    id: "LOG-005",
    timestamp: "2026-08-25T00:10:00.000Z",
    user: "SYSTEM",
    role: "Automated Scheduler",
    action: "SEND_EMAIL_PAYSLIP",
    details: "Mengirimkan slip gaji digital via email ke ahmad.subarjo@veloxpay.co.id.",
    ipAddress: "127.0.0.1"
  }
];

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
