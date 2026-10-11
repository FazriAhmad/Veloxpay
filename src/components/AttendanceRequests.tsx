import React, { useEffect, useState } from 'react';
import { api, AttendanceRequest } from '../lib/api';
import { FormDialog } from './FormDialog';

interface Props {
  // 'employee' submits and withdraws; 'staff' reviews. Only canDecide staff get the decision buttons.
  mode: 'employee' | 'staff';
  canDecide?: boolean;
  addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onDecided?: () => void;
}

const STATUS_STYLE: Record<AttendanceRequest['status'], string> = {
  Pending: 'text-amber-600 bg-amber-50 border-amber-100',
  Approved: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  Rejected: 'text-rose-600 bg-rose-50 border-rose-100',
};
const STATUS_LABEL = { Pending: 'Menunggu', Approved: 'Disetujui', Rejected: 'Ditolak' } as const;
const input = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-primary-500';

type DayStatus = 'present' | 'sick' | 'leave' | 'alpha' | 'off';
interface Day { status: DayStatus; overtime: number }

const DAY_OPTIONS: { value: DayStatus; label: string }[] = [
  { value: 'present', label: 'Hadir' },
  { value: 'sick', label: 'Sakit' },
  { value: 'leave', label: 'Cuti' },
  { value: 'alpha', label: 'Alpha' },
  { value: 'off', label: 'Libur' },
];
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// Weekdays start as Hadir and weekends as Libur, so the employee only edits the exceptions.
const defaultDays = (month: string): Day[] => {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const weekday = new Date(y, m - 1, i + 1).getDay();
    return { status: weekday === 0 || weekday === 6 ? 'off' : 'present', overtime: 0 };
  });
};

export const AttendanceRequests: React.FC<Props> = ({ mode, canDecide, addToast, onDecided }) => {
  const [rows, setRows] = useState<AttendanceRequest[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [days, setDays] = useState<Day[]>(() => defaultDays(new Date().toISOString().slice(0, 7)));
  const [note, setNote] = useState('');
  const totals = {
    present: days.filter((d) => d.status === 'present').length,
    sick: days.filter((d) => d.status === 'sick').length,
    leave: days.filter((d) => d.status === 'leave').length,
    alpha: days.filter((d) => d.status === 'alpha').length,
    overtimeHours: days.reduce((sum, d) => sum + (d.status === 'present' ? d.overtime : 0), 0),
  };
  const setDay = (i: number, patch: Partial<Day>) =>
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<AttendanceRequest | null>(null);

  // Fetch once on mount; actions below reload explicitly. (addToast is not a stable reference,
  // so it must not be an effect dependency or the list would refetch on every render.)
  const load = () =>
    api.listAttendanceRequests().then(setRows, (err) =>
      addToast('Gagal Memuat Pengajuan', err instanceof Error ? err.message : 'Terjadi kesalahan.', 'error'));
  useEffect(() => {
    api.listAttendanceRequests().then(setRows).catch(() => {});
  }, []);

  const run = async (action: () => Promise<unknown>, okTitle: string, failTitle: string, after?: () => void) => {
    setBusy(true);
    try {
      await action();
      addToast(okTitle, '', 'success');
      await load();
      after?.();
    } catch (err) {
      addToast(failTitle, err instanceof Error ? err.message : 'Terjadi kesalahan.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {rejecting && (
        <FormDialog
          title="Tolak pengajuan absensi"
          description={`${rejecting.employeeName}, periode ${rejecting.month}. Absensi payroll tidak berubah.`}
          fields={[{ name: 'note', label: 'Alasan penolakan', type: 'textarea', maxLength: 500, placeholder: 'Mis. Data hadir tidak sesuai catatan' }]}
          submitLabel="Tolak Pengajuan"
          tone="danger"
          onSubmit={(v) => run(() => api.decideAttendanceRequest(rejecting.id, 'Rejected', v.note || undefined), 'Pengajuan Ditolak', 'Gagal Menolak', onDecided)}
          onClose={() => setRejecting(null)}
        />
      )}
      {mode === 'employee' && (
        <form
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api.createAttendanceRequest({ month, ...totals, note }), 'Pengajuan Terkirim', 'Gagal Mengirim Pengajuan');
          }}
        >
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Ajukan Kehadiran & Lembur</h3>
            <p className="text-xs text-slate-500 mt-1">
              Data baru dipakai untuk payroll setelah disetujui admin atau penyetuju.
            </p>
          </div>
          <label className="block text-xs font-semibold text-slate-600 max-w-xs">Periode
            <input
              type="month" required className={input} value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                if (e.target.value) setDays(defaultDays(e.target.value));
              }}
            />
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {days.map((d, i) => {
              const [y, m] = month.split('-').map(Number);
              return (
                <div key={i} className={`p-2 rounded-xl border ${d.status === 'off' ? 'bg-slate-50 border-slate-100' : 'border-slate-200'}`}>
                  <div className="text-[11px] font-bold text-slate-500 mb-1">
                    {i + 1} {DAY_NAMES[new Date(y, m - 1, i + 1).getDay()]}
                  </div>
                  <select
                    aria-label={`Status tanggal ${i + 1}`}
                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    value={d.status}
                    onChange={(e) => setDay(i, { status: e.target.value as DayStatus, overtime: 0 })}
                  >
                    {DAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {d.status === 'present' && (
                    <select
                      aria-label={`Lembur tanggal ${i + 1}`}
                      className="w-full mt-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-600"
                      value={d.overtime}
                      onChange={(e) => setDay(i, { overtime: Number(e.target.value) })}
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                        <option key={h} value={h}>{h === 0 ? 'Tanpa lembur' : `Lembur ${h} jam`}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-slate-600">
            <span>Hadir: {totals.present}</span>
            <span>Sakit: {totals.sick}</span>
            <span>Cuti: {totals.leave}</span>
            <span>Alpha: {totals.alpha}</span>
            <span>Lembur: {totals.overtimeHours} jam</span>
          </div>

          <label className="block text-xs font-semibold text-slate-600">Catatan (opsional)
            <input type="text" maxLength={500} className={input} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button
            type="submit" disabled={busy}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl cursor-pointer"
          >
            Kirim Pengajuan
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-lg">
            {mode === 'employee' ? 'Pengajuan Saya' : 'Pengajuan Kehadiran & Lembur'}
          </h3>
        </div>
        {rows.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">Belum ada pengajuan.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                  {mode === 'staff' && <th className="py-4 px-6">Karyawan</th>}
                  <th className="py-4 px-6">Periode</th>
                  <th className="py-4 px-6">Hadir / Sakit / Cuti / Alpha</th>
                  <th className="py-4 px-6">Lembur</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {rows.map((r) => (
                  <tr key={r.id}>
                    {mode === 'staff' && <td className="py-4 px-6 font-bold text-slate-900">{r.employeeName}</td>}
                    <td className="py-4 px-6 text-slate-700">{r.month}</td>
                    <td className="py-4 px-6 text-slate-700">{r.present} / {r.sick} / {r.leave} / {r.alpha}</td>
                    <td className="py-4 px-6 text-slate-700">
                      {r.overtimeHours} jam
                      {r.note && <div className="text-xs text-slate-400 mt-0.5">{r.note}</div>}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${STATUS_STYLE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.decidedBy && <div className="text-xs text-slate-400 mt-0.5">oleh {r.decidedBy}</div>}
                      {r.decisionNote && <div className="text-xs text-slate-400">{r.decisionNote}</div>}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {r.status === 'Pending' && mode === 'employee' && (
                        <button
                          disabled={busy}
                          onClick={() => run(() => api.cancelAttendanceRequest(r.id), 'Pengajuan Dibatalkan', 'Gagal Membatalkan')}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                        >
                          Batalkan
                        </button>
                      )}
                      {r.status === 'Pending' && mode === 'staff' && canDecide && (
                        <div className="flex justify-center gap-2">
                          <button
                            disabled={busy}
                            onClick={() => run(() => api.decideAttendanceRequest(r.id, 'Approved'), 'Pengajuan Disetujui', 'Gagal Menyetujui', onDecided)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                          >
                            Setujui
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => setRejecting(r)}
                            className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                          >
                            Tolak
                          </button>
                        </div>
                      )}
                      {r.status === 'Pending' && mode === 'staff' && !canDecide && (
                        <span className="text-xs text-slate-400">Menunggu penyetuju</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
