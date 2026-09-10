// Seeds one demo company with the same personas as the old localStorage mock data,
// so the app has something real to log into right after migration. Safe to re-run (idempotent upserts).
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const COMPANY_ID = 'CO-DEMO';
const EMPLOYEES = [
  { id: 'EMP-001', name: 'Ahmad Subarjo', email: 'ahmad.subarjo@veloxpay.co.id', role: 'Senior Software Engineer', department: 'Engineering', baseSalary: 15500000, bankName: 'BCA', bankAccount: '8012345678', joinDate: '2023-01-15' },
  { id: 'EMP-002', name: 'Siti Rahmawati', email: 'siti.rahma@veloxpay.co.id', role: 'UI/UX Designer', department: 'Product Design', baseSalary: 11000000, bankName: 'Mandiri', bankAccount: '131002938475', joinDate: '2023-06-10' },
  { id: 'EMP-003', name: 'Budi Santoso', email: 'budi.santoso@veloxpay.co.id', role: 'HR Specialist', department: 'Human Resources', baseSalary: 9500000, bankName: 'BNI', bankAccount: '0482938472', joinDate: '2024-02-01' },
  { id: 'EMP-004', name: 'Dewi Lestari', email: 'dewi.lestari@veloxpay.co.id', role: 'Finance Lead', department: 'Finance', baseSalary: 13500000, bankName: 'BCA', bankAccount: '8019876543', joinDate: '2022-11-20' },
  { id: 'EMP-005', name: 'Rian Hidayat', email: 'rian.hidayat@veloxpay.co.id', role: 'DevOps Engineer', department: 'Engineering', baseSalary: 14000000, bankName: 'BRI', bankAccount: '03410293847', joinDate: '2024-05-12' },
];
const COMPONENTS = [
  { id: 'COMP-001', name: 'Tunjangan Makan', type: 'allowance', amountType: 'fixed', value: 500000, description: 'Tunjangan uang makan bulanan karyawan' },
  { id: 'COMP-002', name: 'Tunjangan Transportasi', type: 'allowance', amountType: 'fixed', value: 400000, description: 'Tunjangan operasional transportasi' },
  { id: 'COMP-003', name: 'Tunjangan Kesehatan (BPJS)', type: 'allowance', amountType: 'fixed', value: 350000, description: 'Subsidi jaminan kesehatan' },
  { id: 'COMP-004', name: 'Potongan BPJS Ketenagakerjaan', type: 'deduction', amountType: 'percentage', value: 2, description: 'Iuran jaminan hari tua (JHT) karyawan' },
  { id: 'COMP-005', name: 'Potongan Pajak PPh 21', type: 'deduction', amountType: 'percentage', value: 5, description: 'Pajak penghasilan pasal 21 (perhitungan resmi menyusul di Fase 2)' },
  { id: 'COMP-006', name: 'Potongan Keterlambatan', type: 'deduction', amountType: 'fixed', value: 50000, description: 'Denda keterlambatan kehadiran per hari absen/alpha' },
];
const ATTENDANCE = [
  { employeeId: 'EMP-001', month: '2026-09', present: 21, sick: 1, leave: 0, alpha: 0, overtimeHours: 12 },
  { employeeId: 'EMP-002', month: '2026-09', present: 22, sick: 0, leave: 0, alpha: 0, overtimeHours: 5 },
  { employeeId: 'EMP-003', month: '2026-09', present: 20, sick: 1, leave: 1, alpha: 0, overtimeHours: 0 },
  { employeeId: 'EMP-004', month: '2026-09', present: 22, sick: 0, leave: 0, alpha: 0, overtimeHours: 2 },
  { employeeId: 'EMP-005', month: '2026-09', present: 19, sick: 2, leave: 1, alpha: 0, overtimeHours: 18 },
];

// Demo-only credentials — change immediately in any non-local environment.
const ADMIN_PASSWORD = 'admin12345';
const EMPLOYEE_PASSWORD = 'employee12345';

async function seed() {
  await pool.query('INSERT INTO companies (id, name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING', [
    COMPANY_ID,
    'PT Velox Solusi Nusantara',
  ]);

  for (const e of EMPLOYEES) {
    await pool.query(
      `INSERT INTO employees (id, company_id, name, email, role, department, base_salary, bank_name, bank_account, join_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [e.id, COMPANY_ID, e.name, e.email, e.role, e.department, e.baseSalary, e.bankName, e.bankAccount, e.joinDate]
    );
  }

  for (const c of COMPONENTS) {
    await pool.query(
      `INSERT INTO salary_components (id, company_id, name, type, calc_method, value, description, is_editable)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true) ON CONFLICT (id) DO NOTHING`,
      [c.id, COMPANY_ID, c.name, c.type, c.amountType, c.value, c.description]
    );
  }

  for (const a of ATTENDANCE) {
    await pool.query(
      `INSERT INTO attendance (employee_id, month, present, sick, leave, alpha, overtime_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (employee_id, month) DO NOTHING`,
      [a.employeeId, a.month, a.present, a.sick, a.leave, a.alpha, a.overtimeHours]
    );
  }

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (id, company_id, email, password_hash, name, role, employee_id)
     VALUES ('USR-ADMIN', $1, 'dewi.lestari@veloxpay.co.id', $2, 'Dewi Lestari', 'admin', 'EMP-004')
     ON CONFLICT (id) DO NOTHING`,
    [COMPANY_ID, adminHash]
  );

  const employeeHash = await bcrypt.hash(EMPLOYEE_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (id, company_id, email, password_hash, name, role, employee_id)
     VALUES ('USR-EMP1', $1, 'ahmad.subarjo@veloxpay.co.id', $2, 'Ahmad Subarjo', 'employee', 'EMP-001')
     ON CONFLICT (id) DO NOTHING`,
    [COMPANY_ID, employeeHash]
  );

  console.log('Seed complete.');
  console.log('Admin login   -> dewi.lestari@veloxpay.co.id / ' + ADMIN_PASSWORD);
  console.log('Employee login -> ahmad.subarjo@veloxpay.co.id / ' + EMPLOYEE_PASSWORD);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
