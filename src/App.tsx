import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Employee,
  Attendance,
  SalaryComponent,
  PayrollSlip,
  AuditLog,
  ScheduledConfig,
  SimulatedEmail,
  INITIAL_SCHEDULED_CONFIG,
  INITIAL_EMAILS,
} from './lib/mockData';
import { api, setToken, getToken, AuthUser } from './lib/api';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { V1_Payslip } from './components/V1_Payslip';
import { V2_Management } from './components/V2_Management';
import { V3_Automation } from './components/V3_Automation';
import { ToastContainer, ToastMessage } from './components/Toast';
import { PayslipDocument } from './components/PayslipDocument';

function App() {
  // --- APPLICATION STATE ---
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'dashboard'>('landing');
  const [activeTab, setActiveTab] = useState<'v1' | 'v2' | 'v3'>('v1');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBooting, setIsBooting] = useState(!!getToken());

  // --- CORE DATA STATE (server-backed) ---
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [slips, setSlips] = useState<PayrollSlip[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Scheduler config and the email inbox are still local mocks — real scheduling and
  // email delivery arrive in Phase 3, so they stay in localStorage until then.
  const [scheduledConfig, setScheduledConfig] = useState<ScheduledConfig>(() => {
    const saved = localStorage.getItem('velox_scheduled_config');
    return saved ? JSON.parse(saved) : INITIAL_SCHEDULED_CONFIG;
  });
  const [simulatedEmails, setSimulatedEmails] = useState<SimulatedEmail[]>(() => {
    const saved = localStorage.getItem('velox_emails');
    return saved ? JSON.parse(saved) : INITIAL_EMAILS;
  });

  useEffect(() => {
    localStorage.setItem('velox_scheduled_config', JSON.stringify(scheduledConfig));
  }, [scheduledConfig]);

  useEffect(() => {
    localStorage.setItem('velox_emails', JSON.stringify(simulatedEmails));
  }, [simulatedEmails]);

  // --- TOAST NOTIFICATIONS ---
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, title, message, type }]);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // --- DATA LOADING ---
  // Refetches everything the signed-in user is allowed to see. Called after every
  // mutation so the UI always reflects what the server actually stored.
  const loadData = useCallback(async (role: AuthUser['role']) => {
    const [emps, atts, comps, slps, logs] = await Promise.all([
      api.listEmployees(),
      api.listAttendance(),
      api.listComponents(),
      api.listSlips(),
      role === 'admin' ? api.listAuditLogs() : Promise.resolve([] as AuditLog[]),
    ]);
    setEmployees(emps);
    setAttendance(atts);
    setComponents(comps);
    setSlips(slps);
    setAuditLogs(logs);
  }, []);

  // Restore an existing session on refresh instead of dumping the user back to the landing page.
  useEffect(() => {
    if (!getToken()) return;

    (async () => {
      try {
        const me = await api.me();
        setUser(me);
        await loadData(me.role);
        setCurrentView('dashboard');
      } catch {
        setToken(null);
      } finally {
        setIsBooting(false);
      }
    })();
  }, [loadData]);

  // Wraps a mutation so a failed API call always surfaces instead of silently doing nothing.
  const runAction = async (action: () => Promise<void>, errorTitle: string) => {
    if (!user) return;
    try {
      await action();
      await loadData(user.role);
    } catch (err) {
      addToast(errorTitle, err instanceof Error ? err.message : 'Terjadi kesalahan.', 'error');
    }
  };

  // --- AUTH HANDLERS ---
  const handleLogin = async (email: string, password: string) => {
    const { token, user: loggedIn } = await api.login(email, password);
    setToken(token);
    setUser(loggedIn);
    await loadData(loggedIn.role);
    setActiveTab('v1');
    setCurrentView('dashboard');
    addToast(
      'Berhasil Masuk',
      `Selamat datang, ${loggedIn.name} (${loggedIn.role === 'admin' ? 'Administrator' : 'Karyawan'})`,
      'success'
    );
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setEmployees([]);
    setAttendance([]);
    setComponents([]);
    setSlips([]);
    setAuditLogs([]);
    setCurrentView('landing');
    addToast('Keluar', 'Sesi Anda telah diakhiri.', 'info');
  };

  // --- DATA HANDLERS ---
  const handleAddEmployee = (emp: Omit<Employee, 'id' | 'joinDate'>) =>
    runAction(async () => {
      await api.createEmployee(emp);
    }, 'Gagal Menambah Karyawan');

  const handleEditEmployee = (emp: Employee) =>
    runAction(async () => {
      await api.updateEmployee(emp);
    }, 'Gagal Memperbarui Karyawan');

  const handleDeleteEmployee = (id: string) =>
    runAction(async () => {
      await api.deleteEmployee(id);
    }, 'Gagal Menghapus Karyawan');

  const handleGenerateSlip = (slip: Omit<PayrollSlip, 'id' | 'generatedAt'>) =>
    runAction(async () => {
      await api.createSlip(slip);
    }, 'Gagal Membuat Slip');

  const handleDeleteSlip = (id: string) =>
    runAction(async () => {
      await api.deleteSlip(id);
    }, 'Gagal Menghapus Slip');

  const handleUpdateAttendance = (att: Attendance) =>
    runAction(async () => {
      await api.saveAttendance(att);
    }, 'Gagal Memperbarui Kehadiran');

  const handleAddComponent = (comp: Omit<SalaryComponent, 'id' | 'isEditable'>) =>
    runAction(async () => {
      await api.createComponent(comp);
    }, 'Gagal Menambah Komponen');

  const handleUpdateComponent = (comp: SalaryComponent) =>
    runAction(async () => {
      await api.updateComponent(comp);
    }, 'Gagal Memperbarui Komponen');

  const handleDeleteComponent = (id: string) =>
    runAction(async () => {
      await api.deleteComponent(id);
    }, 'Gagal Menghapus Komponen');

  const handleUpdateSlipStatus = (id: string, status: PayrollSlip['status']) =>
    runAction(async () => {
      await api.updateSlipStatus(id, status);
    }, 'Gagal Memperbarui Status Slip');

  const handleUpdateScheduledConfig = (config: ScheduledConfig) => {
    setScheduledConfig(config);
  };

  // Marks every approved slip as paid. VeloxPay never moves money — this records the
  // admin's confirmation that payment already happened through the company's bank.
  const handleMarkAllPaid = () =>
    runAction(async () => {
      const approved = slips.filter((s) => s.status === 'Approved');
      if (approved.length === 0) return;

      await Promise.all(approved.map((s) => api.updateSlipStatus(s.id, 'Paid')));

      const newEmails: SimulatedEmail[] = approved.map((s) => {
        const emp = employees.find((e) => e.id === s.employeeId);
        return {
          id: `EM-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          to: emp?.email || `${s.employeeName.toLowerCase().replace(/\s+/g, '')}@veloxpay.co.id`,
          subject: 'Slip Gaji Digital VeloxPay - September 2026',
          body: `Halo ${s.employeeName},\n\nSlip gaji Anda untuk periode September 2026 telah terbit dan ditandai sudah dibayar oleh tim Finance.\n\nSilakan login ke portal VeloxPay Anda untuk mengunduh dokumen lengkapnya.\n\nTerima kasih,\nVeloxPay`,
          sentAt: new Date().toISOString(),
          isRead: false,
          pdfId: s.id,
        };
      });
      setSimulatedEmails((prev) => [...newEmails, ...prev]);
    }, 'Gagal Menandai Slip Dibayar');

  const handleReadEmail = (id: string) => {
    setSimulatedEmails((prev) => prev.map((e) => (e.id === id ? { ...e, isRead: true } : e)));
  };

  // Quick action: view slip from email link
  const [viewingSlip, setViewingSlip] = useState<PayrollSlip | null>(null);
  const handleViewSlipFromEmail = (slip: PayrollSlip) => {
    setViewingSlip(slip);
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
          <i className="fi fi-rr-spinner animate-spin text-primary-600" />
          Memulihkan sesi...
        </div>
      </div>
    );
  }

  const activeRole = user?.role ?? 'employee';
  const initials = (user?.name || '??')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-primary-100 selection:text-primary-900">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {currentView === 'landing' ? (
        <LandingPage onGoToLogin={() => setCurrentView('login')} />
      ) : currentView === 'login' ? (
        <LoginPage onLogin={handleLogin} onBack={() => setCurrentView('landing')} />
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
                  onClick={handleLogout}
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
                  {initials}
                </div>
                <div>
                  <span className="font-bold text-xs text-white block leading-none">{user?.name}</span>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    {activeRole === 'admin' ? 'Admin / HR Manager' : 'Karyawan'}
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
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

              {/* Right header: session info */}
              <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
                  <i className="fi fi-rr-calendar text-primary-600" />
                  <span>
                    {new Date().toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {/* Role is issued by the server at login — it is no longer switchable from the UI. */}
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200/60 shrink-0">
                  <i className={`fi ${activeRole === 'admin' ? 'fi-rr-user-crown text-primary-600' : 'fi-rr-user text-slate-500'} text-xs`} />
                  <span className="text-xs font-semibold text-slate-800">
                    {activeRole === 'admin' ? 'Admin' : 'Karyawan'}
                  </span>
                  <span className="text-xs text-slate-400 hidden sm:inline">· {user?.email}</span>
                </div>
              </div>
            </header>

            {/* MAIN CONTAINER */}
            <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
              {/* No AnimatePresence here: with React 19 StrictMode its "wait" mode can leave the
                  exiting tab mounted forever, freezing the console on the previous module. */}
              <motion.div
                key={activeTab + '-' + activeRole}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                  {activeTab === 'v1' && (
                    <V1_Payslip
                      employees={employees}
                      attendance={attendance}
                      slips={slips}
                      components={components}
                      activeRole={activeRole}
                      currentEmployeeId={user?.employeeId}
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
                      currentEmployeeId={user?.employeeId}
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
                      currentEmployeeId={user?.employeeId}
                      onUpdateScheduledConfig={handleUpdateScheduledConfig}
                      onDisbursePayroll={handleMarkAllPaid}
                      onReadEmail={handleReadEmail}
                      addToast={addToast}
                      onViewSlipFromEmail={handleViewSlipFromEmail}
                    />
                  )}
              </motion.div>
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
