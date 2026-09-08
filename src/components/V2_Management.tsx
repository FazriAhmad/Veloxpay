import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Employee, Attendance, PayrollSlip, SalaryComponent } from '../lib/mockData';
import { CustomDropdown } from './CustomDropdown';
import { DashboardOverview } from './DashboardOverview';

interface V2ManagementProps {
  employees: Employee[];
  attendance: Attendance[];
  slips: PayrollSlip[];
  components: SalaryComponent[];
  activeRole: 'admin' | 'employee';
  currentEmployeeId?: string;
  onUpdateAttendance: (att: Attendance) => void;
  onAddComponent: (comp: Omit<SalaryComponent, 'id' | 'isEditable'>) => void;
  onUpdateComponent: (comp: SalaryComponent) => void;
  onDeleteComponent: (id: string) => void;
  onUpdateSlipStatus: (id: string, status: PayrollSlip['status'], approvedBy?: string) => void;
  addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const V2_Management: React.FC<V2ManagementProps> = ({
  employees,
  attendance,
  slips,
  components,
  activeRole,
  currentEmployeeId,
  onUpdateAttendance,
  onAddComponent,
  onUpdateComponent,
  onDeleteComponent,
  onUpdateSlipStatus,
  addToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'components' | 'attendance' | 'approval' | 'reports'>('dashboard');

  // Attendance Form State
  const [editingAttendanceId, setEditingAttendanceId] = useState<string | null>(null);
  const [editPresent, setEditPresent] = useState(22);
  const [editSick, setEditSick] = useState(0);
  const [editLeave, setEditLeave] = useState(0);
  const [editAlpha, setEditAlpha] = useState(0);
  const [editOvertime, setEditOvertime] = useState(0);

  // Component Form State
  const [isCompModalOpen, setIsCompModalOpen] = useState(false);
  const [compName, setCompName] = useState('');
  const [compType, setCompType] = useState<'allowance' | 'deduction'>('allowance');
  const [compAmtType, setCompAmtType] = useState<'fixed' | 'percentage'>('fixed');
  const [compValue, setCompValue] = useState('');
  const [compDesc, setCompDesc] = useState('');

  // Report State
  const [reportMonth, setReportMonth] = useState('2026-09');

  // Format IDR Currency
  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  // Save attendance edit
  const handleSaveAttendance = (employeeId: string) => {
    onUpdateAttendance({
      employeeId,
      month: '2026-09', // fixed month for demo
      present: editPresent,
      sick: editSick,
      leave: editLeave,
      alpha: editAlpha,
      overtimeHours: editOvertime,
    });
    setEditingAttendanceId(null);
    addToast('Absensi Diperbarui', 'Data absensi & lembur karyawan berhasil disimpan.', 'success');
  };

  // Start editing attendance
  const startEditingAttendance = (att: Attendance) => {
    setEditingAttendanceId(att.employeeId);
    setEditPresent(att.present);
    setEditSick(att.sick);
    setEditLeave(att.leave);
    setEditAlpha(att.alpha);
    setEditOvertime(att.overtimeHours);
  };

  // Submit salary component
  const handleComponentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName || !compValue || !compDesc) {
      addToast('Formulir Tidak Lengkap', 'Harap isi seluruh data komponen gaji.', 'warning');
      return;
    }

    const valNum = parseFloat(compValue);
    if (isNaN(valNum) || valNum <= 0) {
      addToast('Nilai Tidak Valid', 'Nilai komponen harus berupa angka positif.', 'warning');
      return;
    }

    if (compAmtType === 'percentage' && valNum > 100) {
      addToast('Persentase Tidak Valid', 'Nilai persentase tidak boleh melebihi 100%.', 'warning');
      return;
    }

    onAddComponent({
      name: compName,
      type: compType,
      amountType: compAmtType,
      value: valNum,
      description: compDesc,
    });

    addToast('Komponen Ditambahkan', `Komponen "${compName}" berhasil didaftarkan.`, 'success');
    setIsCompModalOpen(false);
    setCompName('');
    setCompValue('');
    setCompDesc('');
  };

  // Export CSV Report
  const handleExportCSV = () => {
    const monthSlips = slips.filter(s => s.month === reportMonth);
    if (monthSlips.length === 0) {
      addToast('Laporan Kosong', `Tidak ada data slip gaji pada periode ${reportMonth} untuk diekspor.`, 'warning');
      return;
    }

    // Build CSV Content
    let csvContent = "ID Slip,ID Karyawan,Nama Karyawan,Jabatan,Departemen,Gaji Pokok,Total Tunjangan,Lembur,Total Potongan,Gaji Bersih (Net),Status\n";
    
    monthSlips.forEach(s => {
      const totalAllowances = s.allowances.reduce((acc, curr) => acc + curr.amount, 0);
      const totalDeductions = s.deductions.reduce((acc, curr) => acc + curr.amount, 0);
      
      csvContent += `"${s.id}","${s.employeeId}","${s.employeeName}","${s.employeeRole}","${s.employeeDepartment}",${s.baseSalary},${totalAllowances},${s.overtimePay},${totalDeductions},${s.netSalary},"${s.status}"\n`;
    });

    // Create Download Link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_Payroll_VeloxPay_${reportMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('Laporan Diekspor', `Laporan payroll periode ${reportMonth} berhasil diunduh sebagai CSV.`, 'success');
  };

  // Get list of pending slips
  const pendingSlips = slips.filter(s => s.status === 'Draft' || s.status === 'Pending Approval');
  const approvedSlips = slips.filter(s => s.status === 'Approved' || s.status === 'Paid');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 no-print">
        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab('dashboard')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'dashboard'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <i className="fi fi-rr-chart-pie-alt mr-2" /> Dashboard
          </button>
          
          {activeRole === 'admin' && (
            <>
              <button
                onClick={() => setActiveSubTab('components')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  activeSubTab === 'components'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <i className="fi fi-rr-settings-sliders mr-2" /> Komponen Gaji
              </button>
              <button
                onClick={() => setActiveSubTab('attendance')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  activeSubTab === 'attendance'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <i className="fi fi-rr-calendar-clock mr-2" /> Absensi & Lembur
              </button>
              <button
                onClick={() => setActiveSubTab('approval')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  activeSubTab === 'approval'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <i className="fi fi-rr-badge-check mr-2" /> Persetujuan
                {pendingSlips.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold text-white bg-rose-500 rounded-full">
                    {pendingSlips.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveSubTab('reports')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  activeSubTab === 'reports'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <i className="fi fi-rr-document-signed mr-2" /> Laporan
              </button>
            </>
          )}
        </div>

        {activeSubTab === 'components' && activeRole === 'admin' && (
          <button
            onClick={() => setIsCompModalOpen(true)}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <i className="fi fi-rr-plus text-[10px]" /> Tambah Komponen
          </button>
        )}
      </div>

      {/* SUBTAB CONTENT */}
      <AnimatePresence mode="wait">
        {/* DASHBOARD SUBTAB */}
        {activeSubTab === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            <DashboardOverview
              employees={employees}
              slips={slips}
              activeRole={activeRole}
              currentEmployeeId={currentEmployeeId}
              formatIDR={formatIDR}
            />
          </motion.div>
        )}

        {/* SALARY COMPONENTS SUBTAB */}
        {activeSubTab === 'components' && activeRole === 'admin' && (
          <motion.div
            key="components"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {/* Allowances List */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div>
                <span className="px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full border border-emerald-100 uppercase tracking-wider">
                  Tunjangan (Allowances)
                </span>
                <p className="text-xs text-slate-500 mt-2">Daftar komponen pendapatan tambahan yang diberikan ke karyawan.</p>
              </div>

              <div className="divide-y divide-slate-100">
                {components.filter(c => c.type === 'allowance').map((comp) => (
                  <div key={comp.id} className="py-4 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-900 text-sm">{comp.name}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{comp.description}</p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="font-bold text-emerald-600 text-sm block">
                        {comp.amountType === 'fixed' ? formatIDR(comp.value) : `+${comp.value}%`}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(`Hapus komponen ${comp.name}?`)) {
                            onDeleteComponent(comp.id);
                            addToast('Komponen Dihapus', `Komponen ${comp.name} berhasil dihapus.`, 'success');
                          }
                        }}
                        className="text-[10px] font-semibold text-slate-400 hover:text-rose-500 mt-1.5 inline-block"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Deductions List */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div>
                <span className="px-2.5 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 rounded-full border border-rose-100 uppercase tracking-wider">
                  Potongan (Deductions)
                </span>
                <p className="text-xs text-slate-500 mt-2">Daftar komponen pengurangan gaji untuk pajak, iuran bpjs, maupun absensi.</p>
              </div>

              <div className="divide-y divide-slate-100">
                {components.filter(c => c.type === 'deduction').map((comp) => (
                  <div key={comp.id} className="py-4 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-900 text-sm">{comp.name}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{comp.description}</p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="font-bold text-rose-600 text-sm block">
                        {comp.amountType === 'fixed' ? `-${formatIDR(comp.value)}` : `-${comp.value}%`}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(`Hapus komponen ${comp.name}?`)) {
                            onDeleteComponent(comp.id);
                            addToast('Komponen Dihapus', `Komponen ${comp.name} berhasil dihapus.`, 'success');
                          }
                        }}
                        className="text-[10px] font-semibold text-slate-400 hover:text-rose-500 mt-1.5 inline-block"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ATTENDANCE & OVERTIME SUBTAB */}
        {activeSubTab === 'attendance' && activeRole === 'admin' && (
          <motion.div
            key="attendance"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">Manajemen Absensi & Lembur</h3>
              <p className="text-xs text-slate-500 mt-1">
                Data absensi bulan berjalan (September 2026). Perubahan di sini akan langsung mempengaruhi kalkulasi slip gaji baru.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="py-4 px-6">ID Karyawan</th>
                    <th className="py-4 px-6">Karyawan</th>
                    <th className="py-4 px-6 text-center">Hadir (Hari)</th>
                    <th className="py-4 px-6 text-center">Sakit</th>
                    <th className="py-4 px-6 text-center">Izin / Cuti</th>
                    <th className="py-4 px-6 text-center">Absen / Alpha</th>
                    <th className="py-4 px-6 text-center">Jam Lembur</th>
                    <th className="py-4 px-6 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {employees.map((emp) => {
                    const att = attendance.find(a => a.employeeId === emp.id && a.month === '2026-09') || {
                      employeeId: emp.id,
                      month: '2026-09',
                      present: 22,
                      sick: 0,
                      leave: 0,
                      alpha: 0,
                      overtimeHours: 0,
                    };

                    const isEditing = editingAttendanceId === emp.id;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="py-4 px-6 font-semibold text-slate-500">{emp.id}</td>
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900">{emp.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{emp.role}</div>
                        </td>
                        
                        {/* Attendance Inputs / Values */}
                        <td className="py-4 px-6 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editPresent}
                              onChange={(e) => setEditPresent(parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs"
                            />
                          ) : (
                            <span className="font-semibold text-slate-800">{att.present}</span>
                          )}
                        </td>

                        <td className="py-4 px-6 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editSick}
                              onChange={(e) => setEditSick(parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs"
                            />
                          ) : (
                            <span className="font-semibold text-slate-500">{att.sick}</span>
                          )}
                        </td>

                        <td className="py-4 px-6 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editLeave}
                              onChange={(e) => setEditLeave(parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs"
                            />
                          ) : (
                            <span className="font-semibold text-slate-500">{att.leave}</span>
                          )}
                        </td>

                        <td className="py-4 px-6 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editAlpha}
                              onChange={(e) => setEditAlpha(parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs"
                            />
                          ) : (
                            <span className={`font-semibold ${att.alpha > 0 ? 'text-rose-600' : 'text-slate-500'}`}>{att.alpha}</span>
                          )}
                        </td>

                        <td className="py-4 px-6 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editOvertime}
                              onChange={(e) => setEditOvertime(parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs"
                            />
                          ) : (
                            <span className="font-bold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-md text-xs">
                              {att.overtimeHours} Jam
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-6 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleSaveAttendance(emp.id)}
                                className="px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all cursor-pointer"
                              >
                                Simpan
                              </button>
                              <button
                                onClick={() => setEditingAttendanceId(null)}
                                className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditingAttendance(att)}
                              className="px-3 py-1.5 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-all flex items-center gap-1 mx-auto cursor-pointer"
                            >
                              <i className="fi fi-rr-edit" /> Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* APPROVAL WORKFLOW SUBTAB */}
        {activeSubTab === 'approval' && activeRole === 'admin' && (
          <motion.div
            key="approval"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Pending Approvals */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-lg">Menunggu Persetujuan</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Daftar slip gaji draf yang memerlukan verifikasi dan persetujuan manager keuangan sebelum disalurkan.
                </p>
              </div>

              {pendingSlips.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <i className="fi fi-rr-badge-check text-4xl block text-emerald-500" />
                  <span className="text-sm font-semibold block text-slate-800">Semua Slip Bersih!</span>
                  <span className="text-xs">Tidak ada slip gaji yang berstatus draf atau menunggu persetujuan.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                        <th className="py-4 px-6">ID Slip</th>
                        <th className="py-4 px-6">Karyawan</th>
                        <th className="py-4 px-6">Gaji Kotor</th>
                        <th className="py-4 px-6">Potongan</th>
                        <th className="py-4 px-6">Gaji Bersih (Net)</th>
                        <th className="py-4 px-6">Status</th>
                        <th className="py-4 px-6 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {pendingSlips.map((slip) => {
                        const totalAllowances = slip.allowances.reduce((acc, curr) => acc + curr.amount, 0);
                        const totalDeductions = slip.deductions.reduce((acc, curr) => acc + curr.amount, 0);

                        return (
                          <tr key={slip.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="py-4 px-6 font-semibold text-slate-500">{slip.id}</td>
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-900">{slip.employeeName}</div>
                              <div className="text-xs text-slate-400 mt-0.5">{slip.employeeRole}</div>
                            </td>
                            <td className="py-4 px-6 font-semibold text-slate-700">{formatIDR(slip.grossSalary)}</td>
                            <td className="py-4 px-6 font-semibold text-rose-500">-{formatIDR(totalDeductions)}</td>
                            <td className="py-4 px-6 font-bold text-slate-900">{formatIDR(slip.netSalary)}</td>
                            <td className="py-4 px-6">
                              <span className="px-2 py-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 rounded-full border border-amber-100">
                                {slip.status === 'Draft' ? 'Draf' : 'Menunggu Approval'}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    onUpdateSlipStatus(slip.id, 'Approved', 'Dewi Lestari');
                                    addToast('Payroll Disetujui', `Slip gaji untuk ${slip.employeeName} disetujui untuk pembayaran.`, 'success');
                                  }}
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <i className="fi fi-rr-check" /> Setujui
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Yakin ingin menolak slip gaji ini? Slip akan dikembalikan ke draf.')) {
                                      onUpdateSlipStatus(slip.id, 'Draft');
                                      addToast('Payroll Ditolak', `Slip gaji ${slip.employeeName} dikembalikan ke draf.`, 'info');
                                    }
                                  }}
                                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <i className="fi fi-rr-cross" /> Tolak
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Approved History */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-lg">Sudah Disetujui & Siap Dibayar</h3>
                <p className="text-xs text-slate-500 mt-1">Daftar payroll yang telah lolos persetujuan dan siap ditransfer pada V3.</p>
              </div>

              {approvedSlips.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Belum ada payroll yang disetujui untuk bulan berjalan.
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
                        <th className="py-4 px-6">Disetujui Oleh</th>
                        <th className="py-4 px-6">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                      {approvedSlips.map((slip) => (
                        <tr key={slip.id} className="hover:bg-slate-50/20">
                          <td className="py-4 px-6 font-semibold">{slip.id}</td>
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-900">{slip.employeeName}</div>
                            <div className="text-xs text-slate-400">{slip.employeeRole}</div>
                          </td>
                          <td className="py-4 px-6 font-medium">{slip.month}</td>
                          <td className="py-4 px-6 font-bold text-slate-900">{formatIDR(slip.netSalary)}</td>
                          <td className="py-4 px-6 font-semibold text-slate-800">{slip.approvedBy || "SYSTEM"}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              slip.status === 'Paid' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                            }`}>
                              {slip.status === 'Paid' ? 'Sudah Dibayar' : 'Disetujui'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* REPORTS SUBTAB */}
        {activeSubTab === 'reports' && activeRole === 'admin' && (
          <motion.div
            key="reports"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Laporan Rekapitulasi Gaji</h3>
                <p className="text-xs text-slate-500 mt-1">Unduh rekap gaji karyawan bulanan dalam format CSV/Excel.</p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-primary-500"
                />
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <i className="fi fi-rr-download" /> Ekspor Laporan (.CSV)
                </button>
              </div>
            </div>

            {/* Report Table Preview */}
            {slips.filter(s => s.month === reportMonth).length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Tidak ada draf atau slip gaji terbit pada bulan {reportMonth}.
              </div>
            ) : (
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pratinjau Laporan ({reportMonth})</span>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                        <th className="py-3.5 px-4">Karyawan</th>
                        <th className="py-3.5 px-4">Gaji Pokok</th>
                        <th className="py-3.5 px-4">Tunjangan</th>
                        <th className="py-3.5 px-4">Lembur</th>
                        <th className="py-3.5 px-4">Potongan</th>
                        <th className="py-3.5 px-4">Gaji Bersih</th>
                        <th className="py-3.5 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {slips.filter(s => s.month === reportMonth).map((slip) => {
                        const totalAllowances = slip.allowances.reduce((acc, curr) => acc + curr.amount, 0);
                        const totalDeductions = slip.deductions.reduce((acc, curr) => acc + curr.amount, 0);

                        return (
                          <tr key={slip.id} className="hover:bg-slate-50/30">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{slip.employeeName}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{slip.employeeDepartment}</div>
                            </td>
                            <td className="py-3.5 px-4 font-semibold">{formatIDR(slip.baseSalary)}</td>
                            <td className="py-3.5 px-4 font-semibold text-emerald-600">+{formatIDR(totalAllowances)}</td>
                            <td className="py-3.5 px-4 font-semibold text-emerald-600">+{formatIDR(slip.overtimePay)}</td>
                            <td className="py-3.5 px-4 font-semibold text-rose-500">-{formatIDR(totalDeductions)}</td>
                            <td className="py-3.5 px-4 font-bold text-slate-900">{formatIDR(slip.netSalary)}</td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                                slip.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {slip.status === 'Paid' ? 'SUKSES' : 'DRAF/PROSES'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* SALARY COMPONENT MODAL (ADD) */}
      <AnimatePresence>
        {isCompModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-lg">Tambah Komponen Gaji</h3>
                <button
                  onClick={() => setIsCompModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl"
                >
                  <i className="fi fi-rr-cross text-xs" />
                </button>
              </div>

              <form onSubmit={handleComponentSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nama Komponen</label>
                  <input
                    type="text"
                    required
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    placeholder="e.g. Tunjangan Transportasi Tambahan"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Tipe Komponen</label>
                    <select
                      value={compType}
                      onChange={(e) => setCompType(e.target.value as 'allowance' | 'deduction')}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:bg-white transition-all"
                    >
                      <option value="allowance">Tunjangan (+)</option>
                      <option value="deduction">Potongan (-)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Jenis Nominal</label>
                    <select
                      value={compAmtType}
                      onChange={(e) => setCompAmtType(e.target.value as 'fixed' | 'percentage')}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:bg-white transition-all"
                    >
                      <option value="fixed">Nominal Tetap (IDR)</option>
                      <option value="percentage">Persentase (%)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Nilai Komponen {compAmtType === 'percentage' ? '(%)' : '(IDR)'}
                  </label>
                  <input
                    type="number"
                    required
                    value={compValue}
                    onChange={(e) => setCompValue(e.target.value)}
                    placeholder={compAmtType === 'percentage' ? 'e.g. 5' : 'e.g. 500000'}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Deskripsi Singkat</label>
                  <textarea
                    required
                    value={compDesc}
                    onChange={(e) => setCompDesc(e.target.value)}
                    placeholder="Sebutkan kegunaan komponen gaji ini..."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:bg-white transition-all resize-none"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCompModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md transition-all"
                  >
                    Simpan Komponen
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
