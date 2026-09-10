import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PayrollSlip, AuditLog, ScheduledConfig, NotificationLogEntry } from '../lib/mockData';

interface V3AutomationProps {
  slips: PayrollSlip[];
  auditLogs: AuditLog[];
  scheduledConfig: ScheduledConfig;
  notifications: NotificationLogEntry[];
  activeRole: 'admin' | 'employee';
  onUpdateScheduledConfig: (config: ScheduledConfig) => void;
  onDisbursePayroll: () => Promise<void>;
  addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onViewSlipFromEmail: (slip: PayrollSlip) => void;
}

export const V3_Automation: React.FC<V3AutomationProps> = ({
  slips,
  auditLogs,
  scheduledConfig,
  notifications,
  activeRole,
  onUpdateScheduledConfig,
  onDisbursePayroll,
  addToast,
  onViewSlipFromEmail,
}) => {
  // Every sub-tab except "emails" is admin-only, so employees start there rather than
  // on a blank scheduler screen.
  const [activeSubTab, setActiveSubTab] = useState<'scheduler' | 'payment-status' | 'emails' | 'audit' | 'roles'>(
    activeRole === 'employee' ? 'emails' : 'scheduler'
  );

  // Scheduler Form State
  const [schedDay, setSchedDay] = useState(scheduledConfig.dayOfMonth);
  const [schedTime, setSchedTime] = useState(scheduledConfig.time);
  const [schedEnabled, setSchedEnabled] = useState(scheduledConfig.isEnabled);
  const [schedAutoApprove, setSchedAutoApprove] = useState(scheduledConfig.autoApprove);
  const [schedNotify, setSchedNotify] = useState(scheduledConfig.notifyEmail);

  // Notification log detail pane
  const [selectedNotifId, setSelectedNotifId] = useState<string | null>(
    notifications.length > 0 ? notifications[0].id : null
  );

  // Audit search state
  const [auditSearch, setAuditSearch] = useState('');

  // "Marking as paid" in progress (real await, not a simulated multi-step animation)
  const [disbursing, setDisbursing] = useState(false);

  const handleSaveScheduler = () => {
    onUpdateScheduledConfig({
      isEnabled: schedEnabled,
      dayOfMonth: schedDay,
      time: schedTime,
      autoApprove: schedAutoApprove,
      notifyEmail: schedNotify,
    });
    addToast('Konfigurasi Disimpan', 'Penjadwalan payroll otomatis berhasil diperbarui.', 'success');
  };

  // Marks every approved slip "Sudah Dibayar" and triggers the real payslip email
  // (server-side — see PATCH /slips/:id/status). VeloxPay never transfers money
  // itself; this button is a record-keeping action for a transfer already done
  // through the company's own bank.
  const triggerMarkAsPaid = async () => {
    const approvedSlips = slips.filter(s => s.status === 'Approved');
    if (approvedSlips.length === 0) {
      addToast('Tidak Ada Slip', 'Tidak ada slip gaji yang berstatus "Disetujui" untuk ditandai dibayar.', 'warning');
      return;
    }

    setDisbursing(true);
    try {
      await onDisbursePayroll();
      addToast('Status Diperbarui', `${approvedSlips.length} slip ditandai Sudah Dibayar. Notifikasi email diproses.`, 'success');
    } finally {
      setDisbursing(false);
    }
  };

  // Format IDR Currency
  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  // The API already scopes notifications to the caller's own slips for an employee
  // role (see server/routes/notifications.js), so no client-side filtering here.
  const selectedNotif = notifications.find(n => n.id === selectedNotifId);

  const notifStatusMeta: Record<NotificationLogEntry['status'], { dot: string; label: string }> = {
    sent: { dot: 'bg-emerald-500', label: 'Terkirim' },
    failed: { dot: 'bg-rose-500', label: 'Gagal' },
    skipped: { dot: 'bg-amber-500', label: 'Dilewati' },
  };

  // Audit Logs Filtered
  const filteredAuditLogs = auditLogs.filter(log => {
    return log.action.toLowerCase().includes(auditSearch.toLowerCase()) || 
           log.user.toLowerCase().includes(auditSearch.toLowerCase()) ||
           log.details.toLowerCase().includes(auditSearch.toLowerCase());
  });

  // Simulated Roles & Permissions Matrix
  const permissionsData = [
    { key: 'create_emp', name: 'Tambah & Edit Karyawan', admin: true, hr: true, emp: false },
    { key: 'edit_att', name: 'Ubah Absensi & Lembur', admin: true, hr: true, emp: false },
    { key: 'calc_pay', name: 'Hitung Gaji & Buat Draf', admin: true, hr: true, emp: false },
    { key: 'approve_pay', name: 'Persetujuan Payroll (Approval)', admin: true, hr: false, emp: false },
    { key: 'disburse', name: 'Eksekusi Transfer (Disburse)', admin: true, hr: false, emp: false },
    { key: 'view_all', name: 'Lihat Semua Slip Gaji', admin: true, hr: true, emp: false },
    { key: 'view_own', name: 'Lihat Slip Pribadi', admin: true, hr: true, emp: true },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 no-print">
        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
          {activeRole === 'admin' && (
            <>
              <button
                onClick={() => setActiveSubTab('scheduler')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  activeSubTab === 'scheduler'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <i className="fi fi-rr-calendar-clock mr-2" /> Penjadwalan
              </button>
              <button
                onClick={() => setActiveSubTab('payment-status')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  activeSubTab === 'payment-status'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <i className="fi fi-rr-credit-card mr-2" /> Status Pembayaran
              </button>
            </>
          )}
          <button
            onClick={() => setActiveSubTab('emails')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'emails'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <i className="fi fi-rr-envelope mr-2" /> Log Notifikasi Email
            {notifications.filter(n => n.status === 'failed').length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold text-white bg-rose-600 rounded-full">
                {notifications.filter(n => n.status === 'failed').length}
              </span>
            )}
          </button>
          {activeRole === 'admin' && (
            <>
              <button
                onClick={() => setActiveSubTab('audit')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  activeSubTab === 'audit'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <i className="fi fi-rr-shield-check mr-2" /> Log Audit
              </button>
              <button
                onClick={() => setActiveSubTab('roles')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  activeSubTab === 'roles'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <i className="fi fi-rr-key mr-2" /> Peran & Izin
              </button>
            </>
          )}
        </div>
      </div>

      {/* SUBTAB CONTENT — no AnimatePresence mode="wait": under React 19 StrictMode
          it can leave the exiting sub-tab mounted forever (see App.tsx for the same fix). */}
      <>
        {/* SCHEDULER SUBTAB */}
        {activeSubTab === 'scheduler' && activeRole === 'admin' && (
          <motion.div
            key="scheduler"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Config Form */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 lg:col-span-2 space-y-6">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Konfigurasi Penjadwalan Payroll</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Atur agar sistem secara otomatis membuat draf, menyetujui, mentransfer dana, dan mengirim slip gaji.
                </p>
              </div>

              <div className="space-y-4">
                {/* Enable Scheduler Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 text-sm block">Aktifkan Payroll Otomatis</span>
                    <span className="text-xs text-slate-400">Sistem akan berjalan otomatis pada tanggal yang ditentukan.</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={schedEnabled}
                      onChange={(e) => setSchedEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Day selection */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Tanggal Pembayaran Gaji</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      disabled={!schedEnabled}
                      value={schedDay}
                      onChange={(e) => setSchedDay(parseInt(e.target.value) || 25)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-primary-500 outline-none transition-all disabled:opacity-60 disabled:bg-slate-50"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Tanggal setiap bulannya (e.g., 25).</span>
                  </div>

                  {/* Time selection */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Jam Eksekusi</label>
                    <input
                      type="time"
                      disabled={!schedEnabled}
                      value={schedTime}
                      onChange={(e) => setSchedTime(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-primary-500 outline-none transition-all disabled:opacity-60 disabled:bg-slate-50"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Format waktu eksekusi otomatis.</span>
                  </div>
                </div>

                {/* Additional Toggles */}
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Fitur Otomatis Tambahan</span>
                  
                  <label className="flex items-start gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      disabled={!schedEnabled}
                      checked={schedAutoApprove}
                      onChange={(e) => setSchedAutoApprove(e.target.checked)}
                      className="rounded text-primary-600 focus:ring-primary-500 mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Sertakan Persetujuan Otomatis (Auto-Approve)</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Sistem akan menyetujui draf secara otomatis tanpa review HR.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      disabled={!schedEnabled}
                      checked={schedNotify}
                      onChange={(e) => setSchedNotify(e.target.checked)}
                      className="rounded text-primary-600 focus:ring-primary-500 mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Kirim Slip Gaji via Email Otomatis</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Karyawan akan menerima email notifikasi berisi rincian slip sesaat setelah gajian.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={handleSaveScheduler}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Simpan Konfigurasi
                </button>
              </div>
            </div>

            {/* Sidebar info */}
            <div className="space-y-6">
              <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-4 relative overflow-hidden">
                <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-primary-500/20 blur-2xl" />
                <h4 className="font-bold text-sm tracking-wide">Status Scheduler</h4>
                
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full ${schedEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                  <div>
                    <span className="text-xs font-bold block">{schedEnabled ? 'AKTIF' : 'NONAKTIF'}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {schedEnabled ? `Eksekusi berikutnya: Tanggal ${schedDay} pukul ${schedTime}` : 'Jadwal otomatis dimatikan'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Konfigurasi ini menentukan preferensi penjadwalan payroll bulanan. Eksekusi cron sungguhan menyusul di tahap berikutnya — VeloxPay tidak pernah memproses transfer dana, hanya slip gaji dan status pembayarannya.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* PAYMENT STATUS SUBTAB */}
        {activeSubTab === 'payment-status' && activeRole === 'admin' && (
          <motion.div
            key="payment-status"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* disbursement actions */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Status Pembayaran</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Setelah gaji ditransfer lewat rekening perusahaan di luar sistem, tandai slip yang sudah dibayar di sini — VeloxPay mencatat status dan mengirim slip via email, tidak memproses transfer itu sendiri.
                </p>
              </div>

              <button
                onClick={triggerMarkAsPaid}
                disabled={disbursing || slips.filter(s => s.status === 'Approved').length === 0}
                className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {disbursing ? (
                  <>
                    <i className="fi fi-rr-spinner animate-spin" /> Memproses...
                  </>
                ) : (
                  <>
                    <i className="fi fi-rr-check-circle" /> Tandai Sudah Dibayar ({slips.filter(s => s.status === 'Approved').length} Slip)
                  </>
                )}
              </button>
            </div>

            {/* Slips Status Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                      <th className="py-4 px-6">ID Slip</th>
                      <th className="py-4 px-6">Karyawan</th>
                      <th className="py-4 px-6">Rekening (Referensi)</th>
                      <th className="py-4 px-6">Gaji Bersih</th>
                      <th className="py-4 px-6">Status Pembayaran</th>
                      <th className="py-4 px-6">Tanggal Ditandai Dibayar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                    {slips.filter(s => s.month === '2026-09').length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-400 text-xs italic">
                          Tidak ada slip gaji diterbitkan untuk September 2026. Buat slip terlebih dahulu di tab V1.
                        </td>
                      </tr>
                    ) : (
                      slips.filter(s => s.month === '2026-09').map((slip) => (
                        <tr key={slip.id} className="hover:bg-slate-50/20">
                          <td className="py-4 px-6 font-semibold">{slip.id}</td>
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-900">{slip.employeeName}</div>
                            <div className="text-xs text-slate-400">{slip.employeeRole}</div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-semibold text-slate-800">{slip.bankName}</div>
                            <div className="text-xs text-slate-500">{slip.bankAccount}</div>
                          </td>
                          <td className="py-4 px-6 font-bold text-slate-900">{formatIDR(slip.netSalary)}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                              slip.status === 'Paid' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : slip.status === 'Approved'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                : 'bg-slate-50 text-slate-500 border-slate-200'
                            }`}>
                              {slip.status === 'Paid' ? 'Sudah Dibayar' : slip.status === 'Approved' ? 'Siap Ditandai' : 'Menunggu Approval'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-xs">
                            {slip.paymentDate ? (
                              <span className="font-semibold text-slate-800">
                                {new Date(slip.paymentDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Belum ditandai</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* NOTIFICATION LOG SUBTAB — a real record of email delivery attempts, not a
            simulated inbox with fabricated message bodies. */}
        {activeSubTab === 'emails' && (
          <motion.div
            key="emails"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-[550px] grid grid-cols-1 md:grid-cols-3"
          >
            {/* Left Pane: Notification List */}
            <div className="border-r border-slate-100 overflow-y-auto divide-y divide-slate-50">
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Log Notifikasi Email</span>
              </div>

              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs italic">
                  Belum ada notifikasi. Notifikasi terkirim saat slip ditandai Sudah Dibayar.
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => setSelectedNotifId(notif.id)}
                    className={`w-full text-left p-4 hover:bg-slate-50/50 transition-colors flex items-start gap-3 ${
                      selectedNotifId === notif.id ? 'bg-primary-50/60' : ''
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${notifStatusMeta[notif.status].dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{notif.to}</span>
                        <span className="text-[9px] text-slate-400 whitespace-nowrap">
                          {new Date(notif.sentAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className="text-xs mt-1 truncate text-slate-800 font-semibold">{notif.subject}</h4>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{notifStatusMeta[notif.status].label} — {notif.detail}</p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Right Pane: Delivery Detail */}
            <div className="col-span-2 flex flex-col h-full overflow-y-auto">
              {selectedNotif ? (
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-base">{selectedNotif.subject}</h3>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full text-white ${notifStatusMeta[selectedNotif.status].dot}`}>
                          {notifStatusMeta[selectedNotif.status].label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-2">
                        {new Date(selectedNotif.sentAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Kepada: <strong>{selectedNotif.to}</strong>
                      </div>
                    </div>

                    {/* Delivery detail — honest about what actually happened, not a fabricated body */}
                    <div className="text-xs text-slate-700 leading-relaxed font-mono bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {selectedNotif.detail}
                    </div>
                  </div>

                  {/* View Slip Link */}
                  {selectedNotif.slipId && (
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                          <i className="fi fi-rr-document-signed text-lg" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">{selectedNotif.slipId}.pdf</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Format Dokumen Portabel • PDF</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const slip = slips.find(s => s.id === selectedNotif.slipId);
                          if (slip) onViewSlipFromEmail(slip);
                        }}
                        className="px-4 py-2 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <i className="fi fi-rr-eye" /> Tinjau Slip Gaji
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <i className="fi fi-rr-envelope-open text-4xl" />
                  <span className="text-xs">Pilih entri dari log untuk melihat detail pengiriman.</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* AUDIT LOG SUBTAB */}
        {activeSubTab === 'audit' && activeRole === 'admin' && (
          <motion.div
            key="audit"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
          >
            {/* Header / Search */}
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Log Audit Keamanan</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Catatan aktivitas sistem yang tidak dapat diubah (immutable) untuk kepatuhan regulasi dan audit.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <i className="fi fi-rr-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                <input
                  type="text"
                  placeholder="Cari aktivitas / user..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-xs outline-none focus:border-primary-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="py-4 px-6">Waktu Kejadian (WIB)</th>
                    <th className="py-4 px-6">Pengguna</th>
                    <th className="py-4 px-6">Aksi Keamanan</th>
                    <th className="py-4 px-6">Detail Aktivitas</th>
                    <th className="py-4 px-6">Alamat IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                  {filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/20">
                      <td className="py-4 px-6 font-semibold">
                        {new Date(log.timestamp).toLocaleString('id-ID')}
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">{log.user}</div>
                        <div className="text-[10px] text-slate-400">{log.role}</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                          log.action.includes('DISBURSE') || log.action.includes('APPROVE')
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-primary-50 text-primary-700'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-800">{log.details}</td>
                      <td className="py-4 px-6 font-mono text-slate-400">{log.ipAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ROLES & PERMISSIONS SUBTAB */}
        {activeSubTab === 'roles' && activeRole === 'admin' && (
          <motion.div
            key="roles"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6"
          >
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Manajemen Peran & Izin</h3>
              <p className="text-xs text-slate-500 mt-1">
                Matriks hak akses (RBAC) untuk mengontrol fitur yang dapat diakses oleh masing-masing tipe pengguna.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="py-4 px-6">Nama Hak Akses (Permissions)</th>
                    <th className="py-4 px-6 text-center">Super Admin</th>
                    <th className="py-4 px-6 text-center">HR Specialist</th>
                    <th className="py-4 px-6 text-center">Karyawan (Employee)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {permissionsData.map((perm) => (
                    <tr key={perm.key} className="hover:bg-slate-50/30">
                      <td className="py-4 px-6 font-bold">{perm.name}</td>
                      <td className="py-4 px-6 text-center">
                        <i className={`fi ${perm.admin ? 'fi-rr-check-circle text-emerald-500' : 'fi-rr-cross-circle text-slate-300'} text-base`} />
                      </td>
                      <td className="py-4 px-6 text-center">
                        <i className={`fi ${perm.hr ? 'fi-rr-check-circle text-emerald-500' : 'fi-rr-cross-circle text-slate-300'} text-base`} />
                      </td>
                      <td className="py-4 px-6 text-center">
                        <i className={`fi ${perm.emp ? 'fi-rr-check-circle text-emerald-500' : 'fi-rr-cross-circle text-slate-300'} text-base`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 leading-relaxed">
              <strong>Catatan Hak Akses:</strong> Matriks di atas untuk dokumentasi tampilan saja. Pembatasan sesungguhnya ditegakkan oleh server pada setiap permintaan API berdasarkan role di token login Anda — bukan oleh menu yang ditampilkan di sini.
            </div>
          </motion.div>
        )}
      </>
    </div>
  );
};
