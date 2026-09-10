import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Employee,
  Attendance,
  SalaryComponent,
  PayrollSlip,
  AuditLog,
  ScheduledConfig,
  SimulatedEmail,
  INITIAL_EMPLOYEES,
  INITIAL_ATTENDANCE,
  INITIAL_COMPONENTS,
  INITIAL_SLIPS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SCHEDULED_CONFIG,
  INITIAL_EMAILS
} from './lib/mockData';
import { LandingPage } from './components/LandingPage';
import { V1_Payslip } from './components/V1_Payslip';
import { V2_Management } from './components/V2_Management';
import { V3_Automation } from './components/V3_Automation';
import { ToastContainer, ToastMessage } from './components/Toast';
import { PayslipDocument } from './components/PayslipDocument';

function App() {
  // --- APPLICATION STATE ---
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>('landing');
  const [activeTab, setActiveTab] = useState<'v1' | 'v2' | 'v3'>('v1');
  const [activeRole, setActiveRole] = useState<'admin' | 'employee'>('admin');
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string>('EMP-001');

  // --- CORE DATA STATE ---
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('velox_employees');
    return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
  });

  const [attendance, setAttendance] = useState<Attendance[]>(() => {
    const saved = localStorage.getItem('velox_attendance');
    return saved ? JSON.parse(saved) : INITIAL_ATTENDANCE;
  });

  const [components, setComponents] = useState<SalaryComponent[]>(() => {
    const saved = localStorage.getItem('velox_components');
    return saved ? JSON.parse(saved) : INITIAL_COMPONENTS;
  });

  const [slips, setSlips] = useState<PayrollSlip[]>(() => {
    const saved = localStorage.getItem('velox_slips');
    return saved ? JSON.parse(saved) : INITIAL_SLIPS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('velox_audit_logs');
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  const [scheduledConfig, setScheduledConfig] = useState<ScheduledConfig>(() => {
    const saved = localStorage.getItem('velox_scheduled_config');
    return saved ? JSON.parse(saved) : INITIAL_SCHEDULED_CONFIG;
  });

  const [simulatedEmails, setSimulatedEmails] = useState<SimulatedEmail[]>(() => {
    const saved = localStorage.getItem('velox_emails');
    return saved ? JSON.parse(saved) : INITIAL_EMAILS;
  });

  // --- TOAST NOTIFICATIONS ---
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // --- PERSISTENCE TO LOCAL STORAGE ---
  useEffect(() => {
    localStorage.setItem('velox_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('velox_attendance', JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem('velox_components', JSON.stringify(components));
  }, [components]);

  useEffect(() => {
    localStorage.setItem('velox_slips', JSON.stringify(slips));
  }, [slips]);

  useEffect(() => {
    localStorage.setItem('velox_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('velox_scheduled_config', JSON.stringify(scheduledConfig));
  }, [scheduledConfig]);

  useEffect(() => {
    localStorage.setItem('velox_emails', JSON.stringify(simulatedEmails));
  }, [simulatedEmails]);

  // --- AUDIT LOG HELPER ---
  const createAuditLog = (action: string, details: string) => {
    const newLog: AuditLog = {
      id: `LOG-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      user: activeRole === 'admin' ? 'Dewi Lestari' : 'Ahmad Subarjo',
      role: activeRole === 'admin' ? 'Finance Lead' : 'Senior Software Engineer',
      action,
      details,
      ipAddress: '192.168.1.' + Math.floor(Math.random() * 254 + 1),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // --- HANDLERS ---

  // V1: Add Employee
  const handleAddEmployee = (emp: Omit<Employee, 'id' | 'joinDate'>) => {
    const newId = `EMP-0${employees.length + 1}`;
    const newEmp: Employee = {
      ...emp,
      id: newId,
      joinDate: '2026-09-07', // today's date in context
    };
    setEmployees((prev) => [...prev, newEmp]);
    
    // Auto-create blank attendance for Sept 2026
    const newAtt: Attendance = {
      employeeId: newId,
      month: '2026-09',
      present: 22,
      sick: 0,
      leave: 0,
      alpha: 0,
      overtimeHours: 0,
    };
    setAttendance((prev) => [...prev, newAtt]);

    createAuditLog('ADD_EMPLOYEE', `Mendaftarkan karyawan baru ${emp.name} dengan ID ${newId}`);
  };

  // V1: Edit Employee
  const handleEditEmployee = (emp: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));
    createAuditLog('EDIT_EMPLOYEE', `Memperbarui data profil karyawan ${emp.name} (${emp.id})`);
  };

  // V1: Delete Employee
  const handleDeleteEmployee = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    createAuditLog('DELETE_EMPLOYEE', `Menghapus karyawan ${emp?.name || id} dari sistem.`);
  };

  // V1: Generate Slip
  const handleGenerateSlip = (slip: Omit<PayrollSlip, 'id' | 'generatedAt'>) => {
    const newId = `PAY-202609-0${slips.length + 1}`;
    const newSlip: PayrollSlip = {
      ...slip,
      id: newId,
      generatedAt: new Date().toISOString(),
    };
    setSlips((prev) => [newSlip, ...prev]);
    createAuditLog('GENERATE_PAYROLL', `Membuat draf slip gaji untuk ${slip.employeeName} periode ${slip.month}`);
  };

  // V1: Delete Slip
  const handleDeleteSlip = (id: string) => {
    setSlips((prev) => prev.filter((s) => s.id !== id));
    createAuditLog('DELETE_PAYROLL', `Menghapus slip gaji ${id} dari riwayat.`);
  };

  // V2: Update Attendance
  const handleUpdateAttendance = (att: Attendance) => {
    setAttendance((prev) => {
      const idx = prev.findIndex((a) => a.employeeId === att.employeeId && a.month === att.month);
      if (idx > -1) {
        return prev.map((a, i) => (i === idx ? att : a));
      } else {
        return [...prev, att];
      }
    });
    const emp = employees.find((e) => e.id === att.employeeId);
    createAuditLog('UPDATE_ATTENDANCE', `Memperbarui data kehadiran bulanan ${emp?.name || att.employeeId} periode ${att.month}`);
  };

  // V2: Add Salary Component
  const handleAddComponent = (comp: Omit<SalaryComponent, 'id' | 'isEditable'>) => {
    const newId = `COMP-0${components.length + 1}`;
    const newComp: SalaryComponent = {
      ...comp,
      id: newId,
      isEditable: true,
    };
    setComponents((prev) => [...prev, newComp]);
    createAuditLog('ADD_COMPONENT', `Menambahkan komponen gaji baru "${comp.name}" (${comp.type})`);
  };

  // V2: Update Salary Component
  const handleUpdateComponent = (comp: SalaryComponent) => {
    setComponents((prev) => prev.map((c) => (c.id === comp.id ? comp : c)));
    createAuditLog('UPDATE_COMPONENT', `Memperbarui detail komponen gaji "${comp.name}"`);
  };

  // V2: Delete Salary Component
  const handleDeleteComponent = (id: string) => {
    const comp = components.find((c) => c.id === id);
    setComponents((prev) => prev.filter((c) => c.id !== id));
    createAuditLog('DELETE_COMPONENT', `Menghapus komponen gaji "${comp?.name || id}"`);
  };

  // V2: Update Slip Status (Approval Workflow)
  const handleUpdateSlipStatus = (id: string, status: PayrollSlip['status'], approvedBy?: string) => {
    setSlips((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, approvedBy: approvedBy || s.approvedBy } : s))
    );
    const slip = slips.find((s) => s.id === id);
    createAuditLog(
      status === 'Approved' ? 'APPROVE_PAYROLL' : 'REJECT_PAYROLL',
      `Merubah status persetujuan slip ${id} (${slip?.employeeName}) menjadi ${status}`
    );
  };

  // V3: Update Scheduled Config
  const handleUpdateScheduledConfig = (config: ScheduledConfig) => {
    setScheduledConfig(config);
    createAuditLog('UPDATE_SCHEDULE', `Memperbarui penjadwalan otomatis payroll: ${config.isEnabled ? 'AKTIF' : 'NONAKTIF'}, Tanggal ${config.dayOfMonth}`);
  };

  // V3: Mass Disbursement
  const handleDisbursePayroll = () => {
    const dateStr = '2026-09-07'; // current date in context
    const approved = slips.filter((s) => s.status === 'Approved');

    if (approved.length === 0) return;

    // Update statuses
    setSlips((prev) =>
      prev.map((s) => (s.status === 'Approved' ? { ...s, status: 'Paid', paymentDate: dateStr } : s))
    );

    // Create Simulated Emails for each employee
    const newEmails: SimulatedEmail[] = approved.map((s) => {
      const emp = employees.find((e) => e.id === s.employeeId);
      const emailTo = emp?.email || `${s.employeeName.toLowerCase().replace(/\s+/g, '')}@veloxpay.co.id`;
      
      return {
        id: `EM-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        to: emailTo,
        subject: `Slip Gaji Digital VeloxPay - September 2026`,
        body: `Halo ${s.employeeName},\n\nSlip gaji Anda untuk periode September 2026 telah terbit. Dana sebesar ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(s.netSalary)} telah sukses ditransfer ke rekening ${s.bankName} Anda.\n\nSilakan login ke portal VeloxPay Anda untuk mengunduh dokumen PDF lengkap.\n\nTerima kasih,\nVeloxPay Automated Billing`,
        sentAt: new Date().toISOString(),
        isRead: false,
        pdfId: s.id,
      };
    });

    setSimulatedEmails((prev) => [...newEmails, ...prev]);

    // Audit logs
    createAuditLog('DISBURSE_PAYMENT', `Mengeksekusi transfer massal sukses untuk ${approved.length} rekening karyawan via VeloxTransfer.`);
    createAuditLog('SEND_EMAIL_PAYSLIP', `Mengirimkan ${approved.length} notifikasi slip gaji otomatis ke email karyawan.`);
  };

  // V3: Read Email
  const handleReadEmail = (id: string) => {
    setSimulatedEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isRead: true } : e))
    );
  };

  // Navigation and view handlers
  const handleEnterApp = (role: 'admin' | 'employee') => {
    setActiveRole(role);
    setCurrentView('dashboard');
    if (role === 'employee') {
      setCurrentEmployeeId('EMP-001'); // Ahmad Subarjo default
    }
    addToast(
      'Koneksi Berhasil',
      `Masuk sebagai portal ${role === 'admin' ? 'Administrator (Dewi Lestari)' : 'Karyawan (Ahmad Subarjo)'}`,
      'success'
    );
  };

  const handleRoleSwitch = (role: 'admin' | 'employee') => {
    setActiveRole(role);
    if (role === 'employee') {
      setCurrentEmployeeId('EMP-001');
    }
    addToast(
      'Beralih Peran',
      `Sekarang Anda berada di Portal ${role === 'admin' ? 'Administrator' : 'Karyawan'}`,
      'info'
    );
  };

  // Quick action: view slip from email link
  const [viewingSlip, setViewingSlip] = useState<PayrollSlip | null>(null);
  const handleViewSlipFromEmail = (slip: PayrollSlip) => {
    setViewingSlip(slip);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-primary-100 selection:text-primary-900">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {currentView === 'landing' ? (
        <LandingPage onEnterApp={handleEnterApp} />
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
          
          {/* SIDEBAR NAVIGATION (NO-PRINT) */}
          <aside className="w-full lg:w-64 bg-slate-900 text-slate-400 p-6 flex flex-col justify-between shrink-0 border-r border-slate-800 no-print">
            <div className="space-y-8">
              {/* Brand Logo */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-secondary-500 flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
                    <i className="fi fi-rr-bolt text-lg" />
                  </div>
                  <div>
                    <span className="font-bold text-lg tracking-tight text-white block leading-none">VeloxPay</span>
                    <span className="text-[9px] font-semibold text-primary-400 tracking-widest uppercase block mt-1">Console</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCurrentView('landing');
                    addToast('Keluar', 'Anda kembali ke halaman depan.', 'info');
                  }}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors lg:hidden"
                >
                  <i className="fi fi-rr-exit text-xs" />
                </button>
              </div>

              {/* Sidebar Menu */}
              <nav className="space-y-6">
                {/* V1 Menu */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block px-3">Fase V1: Digital Payslip</span>
                  <button
                    onClick={() => {
                      setActiveTab('v1');
                      addToast('Menu V1', 'Membuka modul Digital Payslip.', 'info');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === 'v1'
                        ? 'bg-primary-600 text-white shadow-md shadow-primary-500/10'
                        : 'hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <i className="fi fi-rr-document-signed text-sm" />
                    <span>Digital Payslip Portal</span>
                  </button>
                </div>

                {/* V2 Menu */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block px-3">Fase V2: Payroll Management</span>
                  <button
                    onClick={() => {
                      setActiveTab('v2');
                      addToast('Menu V2', 'Membuka modul Payroll Management.', 'info');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === 'v2'
                        ? 'bg-secondary-600 text-white shadow-md'
                        : 'hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <i className="fi fi-rr-chart-pie-alt text-sm" />
                    <span>Payroll Management</span>
                  </button>
                </div>

                {/* V3 Menu */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block px-3">Fase V3: Automated Payroll</span>
                  <button
                    onClick={() => {
                      setActiveTab('v3');
                      addToast('Menu V3', 'Membuka modul Automated Payroll.', 'info');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === 'v3'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <i className="fi fi-rr-settings-sliders text-sm" />
                    <span>Automated Payroll</span>
                  </button>
                </div>
              </nav>
            </div>

            {/* Sidebar Footer */}
            <div className="space-y-4 pt-6 border-t border-slate-800">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-xs">
                  {activeRole === 'admin' ? 'DL' : 'AS'}
                </div>
                <div>
                  <span className="font-bold text-xs text-white block leading-none">
                    {activeRole === 'admin' ? 'Dewi Lestari' : 'Ahmad Subarjo'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    {activeRole === 'admin' ? 'Admin / HR Manager' : 'Senior Engineer'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setCurrentView('landing');
                  addToast('Keluar', 'Kembali ke halaman depan.', 'info');
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-xs font-semibold text-slate-400 transition-colors cursor-pointer"
              >
                <i className="fi fi-rr-exit" /> Keluar Console
              </button>
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 flex flex-col min-w-0">
            
            {/* HEADER (NO-PRINT) */}
            <header className="bg-white border-b border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
              {/* Left header: breadcrumbs */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-400">VeloxPay Console</span>
                <i className="fi fi-rr-angle-small-right text-slate-300" />
                <span className="font-bold text-slate-800 uppercase tracking-wider">
                  {activeTab === 'v1' ? 'Digital Payslip' : activeTab === 'v2' ? 'Payroll Management' : 'Automated Payroll'}
                </span>
              </div>

              {/* Right header: controls */}
              <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                {/* Simulated Date */}
                <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
                  <i className="fi fi-rr-calendar text-primary-600" />
                  <span>Senin, 7 September 2026</span>
                </div>

                {/* Role Switcher */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/60 shrink-0">
                  <button
                    onClick={() => handleRoleSwitch('admin')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeRole === 'admin'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <i className="fi fi-rr-user-crown mr-1.5" /> Admin
                  </button>
                  <button
                    onClick={() => handleRoleSwitch('employee')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeRole === 'employee'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <i className="fi fi-rr-user mr-1.5" /> Karyawan
                  </button>
                </div>
              </div>
            </header>

            {/* MAIN CONTAINER */}
            <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab + '-' + activeRole}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  {activeTab === 'v1' && (
                    <V1_Payslip
                      employees={employees}
                      attendance={attendance}
                      slips={slips}
                      components={components}
                      activeRole={activeRole}
                      currentEmployeeId={currentEmployeeId}
                      onAddEmployee={handleAddEmployee}
                      onEditEmployee={handleEditEmployee}
                      onDeleteEmployee={handleDeleteEmployee}
                      onGenerateSlip={handleGenerateSlip}
                      onDeleteSlip={handleDeleteSlip}
                      addToast={addToast}
                    />
                  )}

                  {activeTab === 'v2' && (
                    <V2_Management
                      employees={employees}
                      attendance={attendance}
                      slips={slips}
                      components={components}
                      activeRole={activeRole}
                      currentEmployeeId={currentEmployeeId}
                      onUpdateAttendance={handleUpdateAttendance}
                      onAddComponent={handleAddComponent}
                      onUpdateComponent={handleUpdateComponent}
                      onDeleteComponent={handleDeleteComponent}
                      onUpdateSlipStatus={handleUpdateSlipStatus}
                      addToast={addToast}
                    />
                  )}

                  {activeTab === 'v3' && (
                    <V3_Automation
                      employees={employees}
                      slips={slips}
                      auditLogs={auditLogs}
                      scheduledConfig={scheduledConfig}
                      simulatedEmails={simulatedEmails}
                      activeRole={activeRole}
                      currentEmployeeId={currentEmployeeId}
                      onUpdateScheduledConfig={handleUpdateScheduledConfig}
                      onDisbursePayroll={handleDisbursePayroll}
                      onReadEmail={handleReadEmail}
                      addToast={addToast}
                      onViewSlipFromEmail={handleViewSlipFromEmail}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>
      )}

      {/* GLOBAL SLIP VIEWER MODAL (TRIGERRED FROM EMAIL LINK) */}
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
                  <span className="font-bold text-slate-900">Email Attachment Payslip</span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                    Dibayar
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      addToast('Mencetak Slip', 'Membuka dialog pencetakan dokumen...', 'info');
                      window.print();
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fi fi-rr-download" /> Cetak / PDF
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
}

export default App;
