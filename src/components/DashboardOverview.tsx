import React from 'react';
import { motion } from 'framer-motion';
import { Employee, PayrollSlip } from '../lib/mockData';

interface DashboardOverviewProps {
  employees: Employee[];
  slips: PayrollSlip[];
  activeRole: 'admin' | 'employee';
  currentEmployeeId?: string;
  formatIDR: (num: number) => string;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  employees,
  slips,
  activeRole,
  currentEmployeeId,
  formatIDR,
}) => {
  // 1. ADMIN DASHBOARD CALCULATIONS
  const totalEmployees = employees.length;
  const septSlips = slips.filter(s => s.month === '2026-09');
  
  // Total disbursed (Paid status)
  const paidSlips = slips.filter(s => s.status === 'Paid');
  const totalDisbursed = paidSlips.reduce((acc, curr) => acc + curr.netSalary, 0);

  // Total payroll expense (Draft, Approved, Paid) for September 2026
  const totalSeptExpense = septSlips.reduce((acc, curr) => acc + curr.netSalary, 0);
  const averageSeptSalary = septSlips.length > 0 ? Math.round(totalSeptExpense / septSlips.length) : 0;

  // Department distribution for Bar Chart
  const deptSalaries: { [key: string]: number } = {};
  employees.forEach(emp => {
    deptSalaries[emp.department] = (deptSalaries[emp.department] || 0) + emp.baseSalary;
  });

  const deptData = Object.keys(deptSalaries).map(dept => ({
    name: dept,
    value: deptSalaries[dept],
  }));

  const maxDeptSalary = Math.max(...deptData.map(d => d.value), 1);

  // Earnings vs Deductions for Donut Chart
  let totalEarnings = 0;
  let totalDeductions = 0;
  
  septSlips.forEach(s => {
    const allowancesSum = s.allowances.reduce((acc, curr) => acc + curr.amount, 0);
    totalEarnings += s.baseSalary + s.overtimePay + allowancesSum;
    totalDeductions += s.deductions.reduce((acc, curr) => acc + curr.amount, 0);
  });

  // If no slips in September, fallback to August for charts
  if (septSlips.length === 0) {
    const augSlips = slips.filter(s => s.month === '2026-08');
    augSlips.forEach(s => {
      const allowancesSum = s.allowances.reduce((acc, curr) => acc + curr.amount, 0);
      totalEarnings += s.baseSalary + s.overtimePay + allowancesSum;
      totalDeductions += s.deductions.reduce((acc, curr) => acc + curr.amount, 0);
    });
  }

  const totalFinancial = totalEarnings + totalDeductions;
  const earningsPercentage = totalFinancial > 0 ? (totalEarnings / totalFinancial) * 100 : 70;
  const deductionsPercentage = totalFinancial > 0 ? (totalDeductions / totalFinancial) * 100 : 30;

  // 2. EMPLOYEE PORTAL CALCULATIONS (For currentEmployeeId)
  const employee = employees.find(e => e.id === currentEmployeeId);
  const employeeSlips = slips.filter(s => s.employeeId === currentEmployeeId);
  const latestEmployeeSlip = employeeSlips[0]; // sorted or first

  if (activeRole === 'employee' && employee) {
    const personalTotalEarnings = employeeSlips.reduce((acc, curr) => acc + curr.netSalary, 0);
    
    // Personal breakdowns
    const base = latestEmployeeSlip?.baseSalary || employee.baseSalary;
    const allowances = latestEmployeeSlip?.allowances.reduce((acc, curr) => acc + curr.amount, 0) || 0;
    const overtime = latestEmployeeSlip?.overtimePay || 0;
    const deductions = latestEmployeeSlip?.deductions.reduce((acc, curr) => acc + curr.amount, 0) || 0;
    const gross = base + allowances + overtime;
    const net = gross - deductions;

    return (
      <div className="space-y-6">
        {/* Welcome Employee */}
        <div className="bg-gradient-to-r from-primary-900 via-primary-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-[-30%] right-[-10%] w-72 h-72 rounded-full bg-primary-500/20 blur-3xl" />
          <div className="absolute bottom-[-20%] left-[-10%] w-60 h-60 rounded-full bg-secondary-500/10 blur-2xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase">
                Portal Karyawan Terverifikasi
              </span>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">Selamat Datang, {employee.name}!</h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-lg">
                Di sini Anda dapat mengakses slip gaji digital, melacak riwayat pembayaran gaji, melihat absensi bulanan, dan memantau rincian take-home pay Anda secara transparan.
              </p>
            </div>

            <div className="flex gap-4">
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 min-w-36 text-center">
                <span className="text-[10px] text-slate-300 block uppercase font-medium">Gaji Pokok</span>
                <span className="text-base font-bold text-white mt-1 block">{formatIDR(employee.baseSalary)}</span>
              </div>
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 min-w-36 text-center">
                <span className="text-[10px] text-slate-300 block uppercase font-medium">ID Karyawan</span>
                <span className="text-base font-bold text-secondary-300 mt-1 block">{employee.id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Earnings Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Rincian Gaji Terakhir</span>
            
            {latestEmployeeSlip ? (
              <div className="space-y-3">
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Gaji Pokok</span>
                    <span className="font-semibold text-slate-800">{formatIDR(base)}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Tunjangan</span>
                    <span className="font-semibold text-emerald-600">+{formatIDR(allowances)}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Lembur ({latestEmployeeSlip.overtimeHours} Jam)</span>
                    <span className="font-semibold text-emerald-600">+{formatIDR(overtime)}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Potongan</span>
                    <span className="font-semibold text-rose-500">-{formatIDR(deductions)}</span>
                  </div>
                  <div className="py-3 flex justify-between items-center border-t border-slate-200 mt-1">
                    <span className="font-bold text-primary-600">Take Home Pay</span>
                    <span className="text-base font-black text-slate-900">{formatIDR(net)}</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 text-center bg-slate-50 rounded-xl py-2 border border-slate-100">
                  Periode Slip: {latestEmployeeSlip.month} • Status: <strong className="text-emerald-600">LUNAS</strong>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 py-8 text-xs italic">
                Belum ada slip diterbitkan untuk Anda bulan ini.
              </div>
            )}
          </div>

          {/* Visual Breakdown (Custom SVG Gauge) */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-4">Proporsi Pendapatan Bersih</span>
            
            <div className="flex items-center justify-center relative py-4">
              {/* Circular Gauge */}
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="54" className="stroke-slate-100" strokeWidth="12" fill="transparent" />
                <circle
                  cx="64"
                  cy="64"
                  r="54"
                  className="stroke-primary-500"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={339.2}
                  strokeDashoffset={339.2 - (339.2 * (net / (gross || 1)))}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-lg font-black text-slate-900">
                  {gross > 0 ? Math.round((net / gross) * 100) : 100}%
                </span>
                <span className="text-[9px] text-slate-400 uppercase tracking-widest">Diterima</span>
              </div>
            </div>

            <div className="text-center text-xs text-slate-500 mt-2">
              Anda menerima <strong className="text-slate-800">{gross > 0 ? Math.round((net / gross) * 100) : 100}%</strong> dari total pendapatan kotor Anda setelah dikurangi pajak dan iuran BPJS.
            </div>
          </div>

          {/* Quick Bank Information */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Rekening Bank Terdaftar</span>
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-md">
                  <i className="fi fi-rr-credit-card text-base" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Bank Penerima</span>
                  <span className="font-bold text-slate-800 text-sm">{employee.bankName}</span>
                </div>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Nomor Rekening</span>
                  <span className="font-semibold text-slate-800">{employee.bankAccount}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Nama Pemegang</span>
                  <span className="font-semibold text-slate-800">{employee.name}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Metode Transfer</span>
                  <span className="font-bold text-primary-600">VeloxTransfer (Real-time)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Payslip History */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Riwayat Slip Gaji Anda</span>
          {employeeSlips.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic">Belum ada riwayat slip gaji diterbitkan.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {employeeSlips.map(slip => (
                <div key={slip.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center text-slate-600">
                      <i className="fi fi-rr-document-signed text-sm" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-sm block">Periode {slip.month}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">ID Slip: {slip.id}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="font-bold text-slate-900 text-sm block">{formatIDR(slip.netSalary)}</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">Telah Ditransfer</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. ADMIN PORTAL DASHBOARD VIEW
  return (
    <div className="space-y-6">
      {/* Admin Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat 1 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-primary-50 text-primary-600 rounded-2xl">
            <i className="fi fi-rr-users-alt text-xl" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Total Karyawan</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{totalEmployees} Orang</span>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <i className="fi fi-rr-bank text-xl" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Total Terbayar (Disbursed)</span>
            <span className="text-lg font-black text-slate-900 mt-1 block truncate max-w-[180px]">{formatIDR(totalDisbursed)}</span>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
            <i className="fi fi-rr-calculator-money text-xl" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Payroll September 2026</span>
            <span className="text-lg font-black text-slate-900 mt-1 block truncate max-w-[180px]">{formatIDR(totalSeptExpense)}</span>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
            <i className="fi fi-rr-coins text-xl" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Rata-rata Gaji Bersih</span>
            <span className="text-lg font-black text-slate-900 mt-1 block truncate max-w-[180px]">{formatIDR(averageSeptSalary)}</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart: Salary distribution by Department */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-sm tracking-wide">Distribusi Pengeluaran Gaji Pokok per Departemen</h3>
            <p className="text-xs text-slate-400 mt-1">Total alokasi budget gaji berdasarkan departemen operasional.</p>
          </div>

          <div className="space-y-4 pt-4">
            {deptData.length === 0 ? (
              <div className="text-slate-400 text-xs italic text-center py-12">Tidak ada data departemen.</div>
            ) : (
              deptData.map((dept, idx) => {
                const percentage = (dept.value / maxDeptSalary) * 100;
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>{dept.name}</span>
                      <span className="font-bold text-slate-900">{formatIDR(dept.value)}</span>
                    </div>
                    <div className="h-3 bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.1 }}
                        className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Donut Chart: Earnings vs Deductions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm tracking-wide">Perbandingan Finansial Bulanan</h3>
            <p className="text-xs text-slate-400 mt-1">Rasio total pendapatan kotor karyawan dibanding total potongan perusahaan.</p>
          </div>

          {/* Custom SVG Donut Chart */}
          <div className="flex items-center justify-center relative py-6">
            <svg className="w-36 h-32 transform -rotate-90">
              {/* Earnings Circle */}
              <circle
                cx="72"
                cy="64"
                r="48"
                className="stroke-emerald-500"
                strokeWidth="16"
                fill="transparent"
                strokeDasharray={301.6}
                strokeDashoffset={0}
              />
              {/* Deductions Circle */}
              <circle
                cx="72"
                cy="64"
                r="48"
                className="stroke-rose-500"
                strokeWidth="16"
                fill="transparent"
                strokeDasharray={301.6}
                strokeDashoffset={301.6 - (301.6 * (deductionsPercentage / 100))}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Pendapatan</span>
              <span className="text-sm font-black text-emerald-600">{Math.round(earningsPercentage)}%</span>
            </div>
          </div>

          {/* Donut Legend */}
          <div className="grid grid-cols-2 gap-4 text-xs pt-4 border-t border-slate-100">
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Pendapatan Bersih
              </span>
              <span className="text-[10px] text-slate-400 block pl-4">THP & Lembur Karyawan</span>
            </div>
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Potongan
              </span>
              <span className="text-[10px] text-slate-400 block pl-4">BPJS, PPh 21 & Denda</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm tracking-wide">Ringkasan Aktivitas Terkini</h3>
        <div className="divide-y divide-slate-100 text-xs text-slate-600">
          <div className="py-3 flex items-center justify-between gap-4">
            <span className="font-semibold text-slate-800">Sistem Payroll September 2026 Siap</span>
            <span className="text-slate-400">Baru Saja</span>
          </div>
          <div className="py-3 flex items-center justify-between gap-4">
            <span className="font-semibold text-slate-800">Draf Slip Gaji Ahmad Subarjo Berhasil Dibuat</span>
            <span className="text-slate-400">10 Menit Lalu</span>
          </div>
          <div className="py-3 flex items-center justify-between gap-4">
            <span className="font-semibold text-slate-800">Database Karyawan Diperbarui oleh Finance Lead</span>
            <span className="text-slate-400">1 Jam Lalu</span>
          </div>
        </div>
      </div>
    </div>
  );
};
