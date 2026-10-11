import React from 'react';
import { motion } from 'framer-motion';

interface LandingPageProps {
  onGoToLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGoToLogin }) => {
  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col">
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary-100/40 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary-100/40 blur-3xl" />

      {/* Header */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-secondary-500 flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
            <i className="fi fi-rr-bolt text-lg" />
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight text-slate-900 bg-clip-text">VeloxPay</span>
            <span className="text-[10px] block font-semibold text-primary-600 tracking-widest uppercase -mt-1">Payroll Platform</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onGoToLogin}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Portal Karyawan
          </button>
          <button
            onClick={onGoToLogin}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            Portal HR / Admin
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 relative z-10 max-w-7xl mx-auto w-full px-6 flex flex-col lg:flex-row items-center justify-center gap-12 py-12">
        <div className="flex-1 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 border border-primary-100 text-xs font-semibold text-primary-700 mb-6">
              <i className="fi fi-rr-sparkles text-[10px]" /> Era Baru Digitalisasi Payroll
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-tight tracking-tight">
              Proses Payroll Cepat, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-primary-500 to-secondary-500">
                Otomatis & Akurat.
              </span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              VeloxPay mendigitalisasi seluruh ekosistem payroll perusahaan Anda. Mulai dari slip gaji digital, pengelolaan tunjangan, absensi terintegrasi, hingga otomatisasi pengiriman terjadwal dalam satu platform premium.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
          >
            <button
              onClick={onGoToLogin}
              className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 rounded-2xl shadow-xl shadow-primary-500/20 hover:shadow-2xl hover:shadow-primary-500/30 transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              Mulai Demo Admin <i className="fi fi-rr-arrow-right transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={onGoToLogin}
              className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <i className="fi fi-rr-user" /> Portal Karyawan
            </button>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-12 pt-8 border-t border-slate-200/60 grid grid-cols-3 gap-6 max-w-md mx-auto lg:mx-0"
          >
            <div>
              <span className="block text-2xl font-bold text-slate-900">10x</span>
              <span className="text-xs text-slate-500">Lebih Cepat</span>
            </div>
            <div>
              <span className="block text-2xl font-bold text-slate-900">100%</span>
              <span className="text-xs text-slate-500">Akurat & Aman</span>
            </div>
            <div>
              <span className="block text-2xl font-bold text-slate-900">0</span>
              <span className="text-xs text-slate-500">Kertas (Paperless)</span>
            </div>
          </motion.div>
        </div>

        {/* Hero Image/Mockup */}
        <div className="flex-1 w-full relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, rotate: 1 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.8 }}
            className="relative bg-gradient-to-tr from-slate-900 to-slate-800 rounded-3xl p-6 shadow-2xl border border-slate-700/50 max-w-lg mx-auto overflow-hidden"
          >
            {/* Mockup Header */}
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
              <span className="text-xs font-mono text-slate-500">console.veloxpay.co.id</span>
              <span className="w-4" />
            </div>

            {/* Mockup Body - Simulated Dashboard */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400">Total Pengeluaran Gaji</span>
                  <div className="text-xl font-bold text-white mt-1">IDR 63,500,000</div>
                </div>
                <span className="px-2.5 py-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  +12.4% Bulan Ini
                </span>
              </div>

              {/* Mini Chart */}
              <div className="h-28 flex items-end gap-2.5 pt-4">
                <div className="flex-1 bg-slate-700/50 rounded-t-lg h-[40%] relative group">
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-slate-900 text-[10px] text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity mb-1">Jun</div>
                </div>
                <div className="flex-1 bg-slate-700/50 rounded-t-lg h-[55%]" />
                <div className="flex-1 bg-slate-700/50 rounded-t-lg h-[45%]" />
                <div className="flex-1 bg-primary-500 rounded-t-lg h-[80%] relative">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full border-4 border-primary-500" />
                </div>
              </div>

              {/* List of recent payouts */}
              <div className="space-y-2 pt-2 border-t border-slate-700/30">
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-xl border border-slate-700/20">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-xs">AS</div>
                    <div>
                      <div className="text-xs font-semibold text-white">Ahmad Subarjo</div>
                      <div className="text-[10px] text-slate-400">Engineering</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-white">IDR 16,790,000</div>
                    <span className="text-[9px] text-emerald-400 font-medium">Berhasil Ditransfer</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Feature Roadmap (V1, V2, V3) */}
      <section className="bg-white border-t border-slate-100 py-20 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Sistem Payroll Terintegrasi 3 Fase</h2>
            <p className="text-slate-500 mt-4 text-sm sm:text-base">
              Kami merancang VeloxPay dengan struktur fitur bertahap (V1, V2, V3) untuk mendigitalisasi, mengelola, dan mengotomatiskan payroll secara komprehensif.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* V1 Card */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-primary-200 transition-all hover:shadow-xl hover:shadow-slate-100/50 flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center mb-6">
                <i className="fi fi-rr-document-signed text-xl" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg text-slate-900">Fase V1: Digital Payslip</h3>
                <span className="px-2.5 py-0.5 text-[10px] font-bold text-primary-600 bg-primary-50 rounded-full">Core</span>
              </div>
              <p className="text-slate-500 text-xs leading-relaxed mb-6">
                Fokus pada digitalisasi dokumen slip gaji. Menggantikan proses manual dengan slip gaji digital interaktif yang aman dan dapat diunduh kapan saja.
              </p>
              <ul className="space-y-2.5 mt-auto border-t border-slate-200/50 pt-4 text-xs text-slate-600">
                <li className="flex items-center gap-2"><i className="fi fi-rr-check text-emerald-500" /> Autentikasi Login User & Portal</li>
                <li className="flex items-center gap-2"><i className="fi fi-rr-check text-emerald-500" /> Database Karyawan Dasar</li>
                <li className="flex items-center gap-2"><i className="fi fi-rr-check text-emerald-500" /> Form Input Payroll Praktis</li>
                <li className="flex items-center gap-2"><i className="fi fi-rr-check text-emerald-500" /> Generator Slip Gaji & Ekspor PDF</li>
                <li className="flex items-center gap-2"><i className="fi fi-rr-check text-emerald-500" /> Riwayat Slip Gaji Karyawan</li>
              </ul>
            </div>

            {/* V2 Card */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-primary-200 transition-all hover:shadow-xl hover:shadow-slate-100/50 flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-secondary-100 text-secondary-600 flex items-center justify-center mb-6">
                <i className="fi fi-rr-chart-pie-alt text-xl" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg text-slate-900">Fase V2: Payroll Management</h3>
                <span className="px-2.5 py-0.5 text-[10px] font-bold text-secondary-600 bg-secondary-50 rounded-full">Pro</span>
              </div>
              <p className="text-slate-500 text-xs leading-relaxed mb-6">
                Menyediakan kontrol penuh atas komponen-komponen payroll yang kompleks seperti tunjangan variabel, denda keterlambatan, lembur, dan persetujuan.
              </p>
              <ul className="space-y-2.5 mt-auto border-t border-slate-200/50 pt-4 text-xs text-slate-600">
                <li className="flex items-center gap-2"><i className="fi fi-rr-check text-emerald-500" /> Komponen Gaji (Tunjangan & Potongan)</li>
                <li className="flex items-center gap-2"><i className="fi fi-rr-check text-emerald-500" /> Kalkulator Lembur & Absensi Terintegrasi</li>
                <li className="flex items-center gap-2"><i className="fi fi-rr-check text-emerald-500" /> Alur Persetujuan (Approval Workflow)</li>
                <li className="flex items-center gap-2"><i className="fi fi-rr-check text-emerald-500" /> Dashboard Analitik & Laporan Keuangan</li>
                <li className="flex items-center gap-2"><i className="fi fi-rr-check text-emerald-500" /> Ekspor Rekapitulasi Excel/CSV</li>
              </ul>
            </div>

            {/* V3 Card */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-primary-200 transition-all hover:shadow-xl hover:shadow-slate-100/50 flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-6">
                <i className="fi fi-rr-settings-sliders text-xl" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg text-slate-900">Fase V3: Automated Payroll</h3>
                <span className="px-2.5 py-0.5 text-[10px] font-bold text-purple-600 bg-purple-50 rounded-full">Enterprise</span>
              </div>
              <p className="text-slate-500 text-xs leading-relaxed mb-6">
                Menghilangkan intervensi manual sepenuhnya dengan sistem otomatisasi terjadwal, notifikasi email otomatis, log audit ketat, dan pengaturan hak akses.
              </p>
              <ul className="space-y-2.5 mt-auto border-t border-slate-200/50 pt-4 text-xs text-slate-600">
                <li className="flex items-center gap-2"><i className="fi fi-rr-check text-emerald-500" /> Pengiriman Slip & Email Otomatis</li>
                <li className="flex items-center gap-2"><i className="fi fi-rr-check text-emerald-500" /> Penjadwalan Payroll (Scheduled Payroll)</li>
                <li className="flex items-center gap-2"><i className="fi fi-rr-check text-emerald-500" /> Pelacakan Status Pembayaran Real-time</li>
                <li className="flex items-center gap-2"><i className="fi fi-rr-check text-emerald-500" /> Log Audit & Keamanan Ketat</li>
                <li className="flex items-center gap-2"><i className="fi fi-rr-check text-emerald-500" /> Manajemen Role & Hak Akses Detail</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800 text-center text-xs relative z-10 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary-600 flex items-center justify-center text-white">
              <i className="fi fi-rr-bolt text-xs" />
            </div>
            <span className="font-bold text-white">VeloxPay</span>
          </div>
          <p>© 2026 VeloxPay. Hak Cipta Dilindungi. Dibuat untuk Digitalisasi Payroll Modern.</p>
        </div>
      </footer>
    </div>
  );
};
