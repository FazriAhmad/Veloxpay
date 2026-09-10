import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Employee, Attendance, PayrollSlip, SalaryComponent } from '../lib/mockData';
import { CustomDropdown } from './CustomDropdown';
import { PayslipDocument } from './PayslipDocument';

interface V1PayslipProps {
  employees: Employee[];
  attendance: Attendance[];
  slips: PayrollSlip[];
  components: SalaryComponent[];
  activeRole: 'admin' | 'employee';
  currentEmployeeId?: string;
  onAddEmployee: (emp: Omit<Employee, 'id' | 'joinDate'>) => void;
  onEditEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onGenerateSlip: (slip: Omit<PayrollSlip, 'id' | 'generatedAt'>) => void;
  onDeleteSlip: (id: string) => void;
  addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const V1_Payslip: React.FC<V1PayslipProps> = ({
  employees,
  attendance,
  slips,
  components,
  activeRole,
  currentEmployeeId,
  onAddEmployee,
  onEditEmployee,
  onDeleteEmployee,
  onGenerateSlip,
  onDeleteSlip,
  addToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'employees' | 'input' | 'history'>('employees');
  
  // Modals state
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [empModalMode, setEmpModalMode] = useState<'add' | 'edit'>('add');
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  // Employee Form State
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empRole, setEmpRole] = useState('');
  const [empDept, setEmpDept] = useState('');
  const [empBaseSalary, setEmpBaseSalary] = useState('');
  const [empBankName, setEmpBankName] = useState('BCA');
  const [empBankAccount, setEmpBankAccount] = useState('');

  // Payroll Input State
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [payrollMonth, setPayrollMonth] = useState('2026-09');
  
  // Custom allowance/deduction additions inside form
  const [customAllowances, setCustomAllowances] = useState<{ name: string; amount: number }[]>([]);
  const [customDeductions, setCustomDeductions] = useState<{ name: string; amount: number }[]>([]);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomAmount, setNewCustomAmount] = useState('');
  const [newCustomType, setNewCustomType] = useState<'allowance' | 'deduction'>('allowance');

  // Overtime and Attendance overrides in input form
  const [overrideAttendance, setOverrideAttendance] = useState(false);
  const [workingDays, setWorkingDays] = useState('22');
  const [overtimeHours, setOvertimeHours] = useState('0');

  // Selected Slip for Viewer Modal
  const [viewingSlip, setViewingSlip] = useState<PayrollSlip | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Search and Filter for Slip History
  const [historySearch, setHistorySearch] = useState('');
  const [historyMonthFilter, setHistoryMonthFilter] = useState('all');

  // Open Add Employee Modal
  const openAddEmpModal = () => {
    setEmpModalMode('add');
    setEmpName('');
    setEmpEmail('');
    setEmpRole('');
    setEmpDept('');
    setEmpBaseSalary('');
    setEmpBankName('BCA');
    setEmpBankAccount('');
    setIsEmpModalOpen(true);
  };

  // Open Edit Employee Modal
  const openEditEmpModal = (emp: Employee) => {
    setEmpModalMode('edit');
    setEditingEmp(emp);
    setEmpName(emp.name);
    setEmpEmail(emp.email);
    setEmpRole(emp.role);
    setEmpDept(emp.department);
    setEmpBaseSalary(emp.baseSalary.toString());
    setEmpBankName(emp.bankName);
    setEmpBankAccount(emp.bankAccount);
    setIsEmpModalOpen(true);
  };

  const handleEmpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName || !empEmail || !empRole || !empDept || !empBaseSalary || !empBankAccount) {
      addToast('Input Tidak Lengkap', 'Harap isi semua kolom formulir.', 'warning');
      return;
    }

    const salaryNum = parseFloat(empBaseSalary);
    if (isNaN(salaryNum) || salaryNum <= 0) {
      addToast('Gaji Tidak Valid', 'Gaji pokok harus berupa angka positif.', 'warning');
      return;
    }

    if (empModalMode === 'add') {
      onAddEmployee({
        name: empName,
        email: empEmail,
        role: empRole,
        department: empDept,
        baseSalary: salaryNum,
        bankName: empBankName,
        bankAccount: empBankAccount,
      });
      addToast('Karyawan Ditambahkan', `Karyawan ${empName} berhasil didaftarkan.`, 'success');
    } else if (empModalMode === 'edit' && editingEmp) {
      onEditEmployee({
        ...editingEmp,
        name: empName,
        email: empEmail,
        role: empRole,
        department: empDept,
        baseSalary: salaryNum,
        bankName: empBankName,
        bankAccount: empBankAccount,
      });
      addToast('Data Diperbarui', `Data karyawan ${empName} berhasil disimpan.`, 'success');
    }
    setIsEmpModalOpen(false);
  };

  // Select employee for input payroll, auto-populate details
  const handleSelectEmployeeForPayroll = (empId: string) => {
    setSelectedEmpId(empId);
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    // Try to find attendance for this employee
    const att = attendance.find(a => a.employeeId === empId && a.month === payrollMonth);
    if (att) {
      setWorkingDays(att.present.toString());
      setOvertimeHours(att.overtimeHours.toString());
      setOverrideAttendance(false);
    } else {
      setWorkingDays('22');
      setOvertimeHours('0');
      setOverrideAttendance(true);
    }

    // Load initial standard allowances & deductions based on components
    const stdAllowances = components
      .filter(c => c.type === 'allowance')
      .map(c => ({
        name: c.name,
        amount: c.amountType === 'fixed' ? c.value : (emp.baseSalary * c.value) / 100
      }));

    const stdDeductions = components
      .filter(c => c.type === 'deduction' && c.name !== 'Potongan Keterlambatan')
      .map(c => ({
        name: c.name,
        amount: c.amountType === 'fixed' ? c.value : (emp.baseSalary * c.value) / 100
      }));

    // Add absence deduction if employee was absent
    if (att && att.alpha > 0) {
      const lateComp = components.find(c => c.name === 'Potongan Keterlambatan');
      if (lateComp) {
        stdDeductions.push({
          name: `Denda Absen (${att.alpha} Hari)`,
          amount: lateComp.value * att.alpha
        });
      }
    }

    setCustomAllowances(stdAllowances);
    setCustomDeductions(stdDeductions);
  };

  const addCustomComponent = () => {
    if (!newCustomName || !newCustomAmount) {
      addToast('Input Komponen Kustom Gagal', 'Harap isi nama dan nominal komponen.', 'warning');
      return;
    }
    const amt = parseFloat(newCustomAmount);
    if (isNaN(amt) || amt <= 0) {
      addToast('Nominal Tidak Valid', 'Nominal komponen harus berupa angka positif.', 'warning');
      return;
    }

    if (newCustomType === 'allowance') {
      setCustomAllowances([...customAllowances, { name: newCustomName, amount: amt }]);
      addToast('Tunjangan Ditambahkan', `Tunjangan kustom "${newCustomName}" ditambahkan.`, 'success');
    } else {
      setCustomDeductions([...customDeductions, { name: newCustomName, amount: amt }]);
      addToast('Potongan Ditambahkan', `Potongan kustom "${newCustomName}" ditambahkan.`, 'success');
    }
    setNewCustomName('');
    setNewCustomAmount('');
  };

  const removeCustomComponent = (index: number, type: 'allowance' | 'deduction') => {
    if (type === 'allowance') {
      setCustomAllowances(customAllowances.filter((_, i) => i !== index));
    } else {
      setCustomDeductions(customDeductions.filter((_, i) => i !== index));
    }
  };

  const handleGeneratePayroll = () => {
    const emp = employees.find(e => e.id === selectedEmpId);
    if (!emp) {
      addToast('Karyawan Belum Dipilih', 'Silakan pilih karyawan terlebih dahulu.', 'warning');
      return;
    }

    // Check if slip already exists for this employee and month
    const existing = slips.find(s => s.employeeId === emp.id && s.month === payrollMonth);
    if (existing) {
      addToast('Slip Sudah Ada', `Slip gaji untuk ${emp.name} periode ${payrollMonth} sudah dibuat sebelumnya.`, 'warning');
      return;
    }

    // Calculate Overtime
    const hrs = parseFloat(overtimeHours) || 0;
    const hourlyRate = emp.baseSalary / 173;
    const overtimePay = Math.round(hrs * hourlyRate * 1.5);

    // Totals calculation
    const totalAllowances = customAllowances.reduce((acc, curr) => acc + curr.amount, 0);
    const totalDeductions = customDeductions.reduce((acc, curr) => acc + curr.amount, 0);
    
    const grossSalary = emp.baseSalary + totalAllowances + overtimePay;
    const netSalary = grossSalary - totalDeductions;

    onGenerateSlip({
      employeeId: emp.id,
      employeeName: emp.name,
      employeeRole: emp.role,
      employeeDepartment: emp.department,
      month: payrollMonth,
      baseSalary: emp.baseSalary,
      bankName: emp.bankName,
      bankAccount: emp.bankAccount,
      allowances: customAllowances,
      deductions: customDeductions,
      overtimeHours: hrs,
      overtimePay: overtimePay,
      grossSalary: grossSalary,
      netSalary: netSalary,
      status: 'Draft', // Generates as draft, can be approved in V2
    });

    addToast('Payroll Draf Berhasil Dibuat', `Draf slip gaji untuk ${emp.name} bulan ${payrollMonth} telah disimpan ke riwayat.`, 'success');
    
    // Clear inputs and switch to history
    setSelectedEmpId('');
    setCustomAllowances([]);
    setCustomDeductions([]);
    setActiveSubTab('history');
  };

  // Simulated PDF Download
  const handleDownloadPDF = (slip: PayrollSlip) => {
    setIsDownloading(true);
    addToast('Memproses PDF', 'Sedang mengompilasi dokumen slip gaji digital...', 'info');
    
    setTimeout(() => {
      setIsDownloading(false);
      addToast('PDF Berhasil Diunduh', `Slip gaji ${slip.employeeName} - ${slip.month}.pdf berhasil disimpan.`, 'success');
      
      // Real window print layout trigger
      const printContent = document.getElementById('printable-payslip');
      if (printContent) {
        window.print();
      }
    }, 2000);
  };

  // Filtered Slips for History
  const filteredSlips = slips.filter(slip => {
    // If employee role: only show their own slips
    if (activeRole === 'employee' && currentEmployeeId && slip.employeeId !== currentEmployeeId) {
      return false;
    }

    const matchesSearch = slip.employeeName.toLowerCase().includes(historySearch.toLowerCase()) || 
                          slip.id.toLowerCase().includes(historySearch.toLowerCase());
    const matchesMonth = historyMonthFilter === 'all' || slip.month === historyMonthFilter;
    
    return matchesSearch && matchesMonth;
  });

  // Format IDR Currency
  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const getStatusBadge = (status: PayrollSlip['status']) => {
    const styles = {
      Draft: 'bg-slate-100 text-slate-700 border-slate-200',
      'Pending Approval': 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse',
      Approved: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${styles[status]}`}>
        {status === 'Draft' ? 'Draf' : status === 'Pending Approval' ? 'Menunggu Approval' : status === 'Approved' ? 'Disetujui' : 'Dibayar'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 no-print">
        <div className="flex gap-2">
          {activeRole === 'admin' && (
            <>
              <button
                onClick={() => setActiveSubTab('employees')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  activeSubTab === 'employees'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <i className="fi fi-rr-users-alt mr-2" /> Data Karyawan
              </button>
              <button
                onClick={() => setActiveSubTab('input')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  activeSubTab === 'input'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <i className="fi fi-rr-calculator-money mr-2" /> Input Payroll
              </button>
            </>
          )}
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'history'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <i className="fi fi-rr-receipt mr-2" /> Riwayat Slip
          </button>
        </div>

        {activeSubTab === 'employees' && activeRole === 'admin' && (
          <button
            onClick={openAddEmpModal}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md shadow-primary-500/15 transition-all flex items-center gap-2 cursor-pointer"
          >
            <i className="fi fi-rr-plus text-[10px]" /> Tambah Karyawan
          </button>
        )}
      </div>

      {/* SUBTAB CONTENT */}
      <AnimatePresence mode="wait">
        {/* EMPLOYEES LIST SUBTAB */}
        {activeSubTab === 'employees' && activeRole === 'admin' && (
          <motion.div
            key="employees"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Daftar Karyawan</h3>
                <p className="text-xs text-slate-500 mt-1">Kelola data karyawan dasar untuk dasar perhitungan payroll bulanan.</p>
              </div>
              <div className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2">
                Total Karyawan: <span className="font-bold text-primary-600">{employees.length} Orang</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="py-4 px-6">ID Karyawan</th>
                    <th className="py-4 px-6">Nama Lengkap</th>
                    <th className="py-4 px-6">Jabatan / Divisi</th>
                    <th className="py-4 px-6">Gaji Pokok</th>
                    <th className="py-4 px-6">Informasi Bank</th>
                    <th className="py-4 px-6 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-600">{emp.id}</td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">{emp.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{emp.email}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-medium text-slate-800">{emp.role}</div>
                        <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-md">
                          {emp.department}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-900">{formatIDR(emp.baseSalary)}</td>
                      <td className="py-4 px-6">
                        <div className="text-xs font-semibold text-slate-800">{emp.bankName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{emp.bankAccount}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditEmpModal(emp)}
                            className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                            title="Edit Data"
                          >
                            <i className="fi fi-rr-edit text-xs" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Apakah Anda yakin ingin menghapus karyawan ${emp.name}?`)) {
                                onDeleteEmployee(emp.id);
                                addToast('Karyawan Dihapus', `Karyawan ${emp.name} telah dihapus dari sistem.`, 'success');
                              }
                            }}
                            className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Hapus Karyawan"
                          >
                            <i className="fi fi-rr-trash text-xs" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* INPUT PAYROLL SUBTAB */}
        {activeSubTab === 'input' && activeRole === 'admin' && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Form Input Container */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 lg:col-span-2 space-y-6">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Input Data Payroll</h3>
                <p className="text-xs text-slate-500 mt-1">Pilih karyawan untuk menghitung slip gaji periode berjalan.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Employee Dropdown */}
                <CustomDropdown
                  label="Pilih Karyawan"
                  placeholder="Cari & pilih karyawan..."
                  options={employees.map(e => ({
                    value: e.id,
                    label: `${e.name} (${e.id})`,
                    icon: 'fi-rr-user'
                  }))}
                  value={selectedEmpId}
                  onChange={handleSelectEmployeeForPayroll}
                />

                {/* Period Month */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                    Periode Payroll
                  </label>
                  <input
                    type="month"
                    value={payrollMonth}
                    onChange={(e) => {
                      setPayrollMonth(e.target.value);
                      if (selectedEmpId) handleSelectEmployeeForPayroll(selectedEmpId);
                    }}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                  />
                </div>
              </div>

              {selectedEmpId ? (
                <>
                  {/* Attendance & Overtime overrides */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <i className="fi fi-rr-calendar-clock text-primary-600" />
                        <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">Absensi & Lembur</span>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={overrideAttendance}
                          onChange={(e) => setOverrideAttendance(e.target.checked)}
                          className="rounded text-primary-600 focus:ring-primary-500"
                        />
                        Ubah Manual
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Hari Kerja (Hadir)</label>
                        <input
                          type="number"
                          disabled={!overrideAttendance}
                          value={workingDays}
                          onChange={(e) => setWorkingDays(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all disabled:opacity-60 disabled:bg-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Jam Lembur (Jam)</label>
                        <input
                          type="number"
                          disabled={!overrideAttendance}
                          value={overtimeHours}
                          onChange={(e) => setOvertimeHours(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all disabled:opacity-60 disabled:bg-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Salary components details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Allowances list */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Tunjangan (Pendapatan)
                        </span>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {customAllowances.map((allow, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                            <span className="font-medium text-slate-600">{allow.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-emerald-600">{formatIDR(allow.amount)}</span>
                              <button
                                onClick={() => removeCustomComponent(idx, 'allowance')}
                                className="text-slate-400 hover:text-rose-500"
                              >
                                <i className="fi fi-rr-cross-small" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Deductions list */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500" /> Potongan (Pengurangan)
                        </span>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {customDeductions.map((ded, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                            <span className="font-medium text-slate-600">{ded.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-rose-600">{formatIDR(ded.amount)}</span>
                              <button
                                onClick={() => removeCustomComponent(idx, 'deduction')}
                                className="text-slate-400 hover:text-rose-500"
                              >
                                <i className="fi fi-rr-cross-small" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Add component inline form */}
                  <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3">
                    <span className="text-xs font-bold text-slate-700 block">Tambah Komponen Gaji Kustom</span>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <input
                        type="text"
                        placeholder="Nama komponen..."
                        value={newCustomName}
                        onChange={(e) => setNewCustomName(e.target.value)}
                        className="sm:col-span-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-primary-500"
                      />
                      <input
                        type="number"
                        placeholder="Nominal (IDR)..."
                        value={newCustomAmount}
                        onChange={(e) => setNewCustomAmount(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-primary-500"
                      />
                      <div className="flex gap-2">
                        <select
                          value={newCustomType}
                          onChange={(e) => setNewCustomType(e.target.value as 'allowance' | 'deduction')}
                          className="px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-primary-500 flex-1"
                        >
                          <option value="allowance">Tunjangan</option>
                          <option value="deduction">Potongan</option>
                        </select>
                        <button
                          onClick={addCustomComponent}
                          className="px-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl flex items-center justify-center cursor-pointer"
                        >
                          <i className="fi fi-rr-plus" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Submit Payroll */}
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={handleGeneratePayroll}
                      className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 rounded-2xl shadow-lg shadow-primary-500/20 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <i className="fi fi-rr-calculator" /> Hitung & Buat Slip Gaji
                    </button>
                  </div>
                </>
              ) : (
                <div className="h-64 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-2">
                  <i className="fi fi-rr-user-add text-3xl" />
                  <span className="text-xs">Silakan pilih karyawan terlebih dahulu untuk memulai perhitungan.</span>
                </div>
              )}
            </div>

            {/* Quick Summary of Base Employee */}
            <div className="space-y-6">
              {selectedEmpId && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Ringkasan Karyawan</span>
                  {(() => {
                    const emp = employees.find(e => e.id === selectedEmpId);
                    if (!emp) return null;
                    return (
                      <div className="space-y-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 font-bold">
                            {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-none">{emp.name}</h4>
                            <span className="text-xs text-slate-400 mt-1 block">{emp.role}</span>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100 text-xs">
                          <div className="py-2.5 flex justify-between">
                            <span className="text-slate-500">Gaji Pokok</span>
                            <span className="font-bold text-slate-900">{formatIDR(emp.baseSalary)}</span>
                          </div>
                          <div className="py-2.5 flex justify-between">
                            <span className="text-slate-500">Bank Transfer</span>
                            <span className="font-semibold text-slate-800">{emp.bankName} - {emp.bankAccount}</span>
                          </div>
                          <div className="py-2.5 flex justify-between">
                            <span className="text-slate-500">Tanggal Gabung</span>
                            <span className="font-semibold text-slate-800">{emp.joinDate}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-4 relative overflow-hidden">
                <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-primary-500/20 blur-2xl" />
                <h4 className="font-bold text-sm tracking-wide">Fase V1: Digital Payslip</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Pada fase ini, Anda dapat mengelola karyawan, menginput payroll, melakukan review slip gaji secara interaktif, dan mengekspornya langsung menjadi file PDF berkualitas tinggi untuk dicetak atau disimpan.
                </p>
                <div className="flex items-center gap-2 text-xs text-primary-400 font-semibold">
                  <i className="fi fi-rr-shield-check" /> <span>Keamanan Data Terjamin</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* SLIP HISTORY SUBTAB */}
        {activeSubTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
          >
            {/* Search and Filters */}
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Riwayat Slip Gaji</h3>
                <p className="text-xs text-slate-500 mt-1">Cari, tinjau, dan unduh slip gaji digital yang telah diterbitkan.</p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <i className="fi fi-rr-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                  <input
                    type="text"
                    placeholder="Cari karyawan / ID..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-xs outline-none focus:border-primary-500 focus:bg-white transition-all"
                  />
                </div>

                <select
                  value={historyMonthFilter}
                  onChange={(e) => setHistoryMonthFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-xs outline-none focus:border-primary-500 text-slate-600"
                >
                  <option value="all">Semua Bulan</option>
                  <option value="2026-09">September 2026</option>
                  <option value="2026-08">Agustus 2026</option>
                </select>
              </div>
            </div>

            {/* Slips Table */}
            {filteredSlips.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <i className="fi fi-rr-document-signed text-4xl block" />
                <span className="text-sm block">Tidak ada riwayat slip gaji ditemukan.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                      <th className="py-4 px-6">ID Slip</th>
                      <th className="py-4 px-6">Karyawan</th>
                      <th className="py-4 px-6">Periode</th>
                      <th className="py-4 px-6">Gaji Bersih (Net)</th>
                      <th className="py-4 px-6">Status Pembayaran</th>
                      <th className="py-4 px-6 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredSlips.map((slip) => (
                      <tr key={slip.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 font-semibold text-slate-600">{slip.id}</td>
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900">{slip.employeeName}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{slip.employeeRole}</div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-semibold text-slate-700">
                            {new Date(slip.month + "-01").toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-900">{formatIDR(slip.netSalary)}</td>
                        <td className="py-4 px-6">{getStatusBadge(slip.status)}</td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setViewingSlip(slip)}
                              className="px-3 py-1.5 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <i className="fi fi-rr-eye" /> Lihat
                            </button>
                            <button
                              onClick={() => handleDownloadPDF(slip)}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <i className="fi fi-rr-download" /> PDF
                            </button>
                            {activeRole === 'admin' && (
                              <button
                                onClick={() => {
                                  if (confirm('Apakah Anda yakin ingin menghapus slip gaji ini?')) {
                                    onDeleteSlip(slip.id);
                                    addToast('Slip Dihapus', 'Slip gaji berhasil dihapus dari riwayat.', 'success');
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Hapus Slip"
                              >
                                <i className="fi fi-rr-trash text-xs" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* EMPLOYEE MODAL (ADD / EDIT) */}
      <AnimatePresence>
        {isEmpModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-lg">
                  {empModalMode === 'add' ? 'Tambah Karyawan Baru' : 'Edit Data Karyawan'}
                </h3>
                <button
                  onClick={() => setIsEmpModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl"
                >
                  <i className="fi fi-rr-cross text-xs" />
                </button>
              </div>

              <form onSubmit={handleEmpSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      required
                      value={empName}
                      onChange={(e) => setEmpName(e.target.value)}
                      placeholder="e.g. Ahmad Subarjo"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Email Perusahaan</label>
                    <input
                      type="email"
                      required
                      value={empEmail}
                      onChange={(e) => setEmpEmail(e.target.value)}
                      placeholder="e.g. ahmad@company.co.id"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Jabatan / Peran</label>
                    <input
                      type="text"
                      required
                      value={empRole}
                      onChange={(e) => setEmpRole(e.target.value)}
                      placeholder="e.g. Software Engineer"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Departemen / Divisi</label>
                    <input
                      type="text"
                      required
                      value={empDept}
                      onChange={(e) => setEmpDept(e.target.value)}
                      placeholder="e.g. Engineering"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Gaji Pokok (IDR)</label>
                    <input
                      type="number"
                      required
                      value={empBaseSalary}
                      onChange={(e) => setEmpBaseSalary(e.target.value)}
                      placeholder="e.g. 10000000"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Nama Bank</label>
                    <select
                      value={empBankName}
                      onChange={(e) => setEmpBankName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:bg-white transition-all"
                    >
                      <option value="BCA">BCA (Bank Central Asia)</option>
                      <option value="Mandiri">Bank Mandiri</option>
                      <option value="BNI">BNI (Bank Negara Indonesia)</option>
                      <option value="BRI">BRI (Bank Rakyat Indonesia)</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Nomor Rekening</label>
                    <input
                      type="text"
                      required
                      value={empBankAccount}
                      onChange={(e) => setEmpBankAccount(e.target.value)}
                      placeholder="e.g. 8012345678"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEmpModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md shadow-primary-500/15 transition-all"
                  >
                    Simpan Data
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PAYSLIP VIEWER MODAL (WITH PRINT-FRIENDLY CSS DESIGN) */}
      <AnimatePresence>
        {viewingSlip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden my-8 border border-slate-100"
            >
              {/* Modal Header Actions (No Print) */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 no-print">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">Digital Payslip Preview</span>
                  {getStatusBadge(viewingSlip.status)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadPDF(viewingSlip)}
                    disabled={isDownloading}
                    className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isDownloading ? (
                      <>
                        <i className="fi fi-rr-spinner animate-spin" /> Mengunduh...
                      </>
                    ) : (
                      <>
                        <i className="fi fi-rr-download" /> Unduh PDF / Cetak
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setViewingSlip(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    <i className="fi fi-rr-cross text-xs" />
                  </button>
                </div>
              </div>

              <PayslipDocument slip={viewingSlip} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
