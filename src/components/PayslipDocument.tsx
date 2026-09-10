import { PayrollSlip } from '../lib/mockData';
import { formatIDR } from '../lib/format';

interface PayslipDocumentProps {
  slip: PayrollSlip;
  approvedByFallback?: string;
}

export const PayslipDocument: React.FC<PayslipDocumentProps> = ({ slip, approvedByFallback = 'Dewi Lestari' }) => {
  const statusLabel = slip.status === 'Paid' ? 'SUDAH DIBAYAR' : slip.status === 'Approved' ? 'DISETUJUI' : 'DRAF';

  return (
    <div id="printable-payslip" className="p-8 space-y-6 text-slate-800 print-card">
      {/* Payslip Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-900/10 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-secondary-500 flex items-center justify-center text-white shadow-md">
            <i className="fi fi-rr-bolt text-xl" />
          </div>
          <div>
            <h2 className="font-black text-xl tracking-tight text-slate-900 leading-none">VeloxPay</h2>
            <span className="text-[9px] font-semibold text-slate-400 tracking-wider uppercase block mt-1">PT Velox Solusi Nusantara</span>
          </div>
        </div>
        <div className="text-right">
          <h3 className="font-black text-lg text-slate-900">SLIP GAJI DIGITAL</h3>
          <span className="text-xs text-slate-500">ID Dokumen: {slip.id}</span>
        </div>
      </div>

      {/* Metadata Details */}
      <div className="grid grid-cols-2 gap-6 text-xs border-b border-slate-100 pb-6">
        <div className="space-y-2">
          <div className="grid grid-cols-3">
            <span className="text-slate-400">Nama Karyawan</span>
            <span className="col-span-2 font-bold text-slate-900">: {slip.employeeName}</span>
          </div>
          <div className="grid grid-cols-3">
            <span className="text-slate-400">ID Karyawan</span>
            <span className="col-span-2 font-semibold text-slate-700">: {slip.employeeId}</span>
          </div>
          <div className="grid grid-cols-3">
            <span className="text-slate-400">Jabatan / Divisi</span>
            <span className="col-span-2 font-semibold text-slate-700">: {slip.employeeRole} / {slip.employeeDepartment}</span>
          </div>
        </div>

        <div className="space-y-2 text-right">
          <div className="grid grid-cols-3">
            <span className="text-slate-400 text-left sm:text-right col-span-2">Periode Gaji</span>
            <span className="font-bold text-slate-900 text-right">
              : {new Date(slip.month + "-01").toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </span>
          </div>
          <div className="grid grid-cols-3">
            <span className="text-slate-400 text-left sm:text-right col-span-2">Status Pembayaran</span>
            <span className="font-bold text-emerald-600 text-right">
              : {statusLabel}
            </span>
          </div>
          <div className="grid grid-cols-3">
            <span className="text-slate-400 text-left sm:text-right col-span-2">Tanggal Terbit</span>
            <span className="font-semibold text-slate-700 text-right">
              : {new Date(slip.generatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Breakdown Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
        {/* Earnings */}
        <div className="space-y-3">
          <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2">1. PENDAPATAN (EARNINGS)</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Gaji Pokok</span>
              <span className="font-semibold text-slate-800">{formatIDR(slip.baseSalary)}</span>
            </div>
            {slip.overtimeHours > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Lembur ({slip.overtimeHours} Jam)</span>
                <span className="font-semibold text-slate-800">{formatIDR(slip.overtimePay)}</span>
              </div>
            )}
            {slip.allowances.map((allow, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="text-slate-500">{allow.name}</span>
                <span className="font-semibold text-slate-800">{formatIDR(allow.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Deductions */}
        <div className="space-y-3">
          <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2">2. POTONGAN (DEDUCTIONS)</h4>
          <div className="space-y-2">
            {slip.deductions.length === 0 ? (
              <div className="text-slate-400 italic">Tidak ada potongan.</div>
            ) : (
              slip.deductions.map((ded, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-slate-500">{ded.name}</span>
                  <span className="font-semibold text-slate-800 text-rose-600">({formatIDR(ded.amount)})</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Summary Totals */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <span className="text-slate-400 block mb-1">Total Pendapatan Kotor</span>
          <span className="font-bold text-slate-800">{formatIDR(slip.grossSalary)}</span>
        </div>
        <div>
          <span className="text-slate-400 block mb-1">Total Potongan</span>
          <span className="font-bold text-rose-600">
            ({formatIDR(slip.deductions.reduce((acc, curr) => acc + curr.amount, 0))})
          </span>
        </div>
        <div className="border-t md:border-t-0 md:border-l border-slate-200/60 pt-3 md:pt-0 md:pl-4">
          <span className="text-primary-600 font-bold block mb-1 uppercase tracking-wider">Gaji Bersih Diterima (THP)</span>
          <span className="text-lg font-black text-slate-900">{formatIDR(slip.netSalary)}</span>
        </div>
      </div>

      {/* Reference Bank Account (informational only — VeloxPay does not process transfers) */}
      <div className="text-xs bg-slate-50/50 rounded-xl p-3 border border-slate-100 text-slate-500 flex items-center justify-between">
        <span>Rekening tujuan (referensi): <strong className="text-slate-700">{slip.bankName} - {slip.bankAccount}</strong></span>
        {slip.status === 'Paid' && (
          <span className="font-semibold text-emerald-600 flex items-center gap-1">
            <i className="fi fi-rr-check-circle text-[10px]" /> Ditandai Sudah Dibayar
          </span>
        )}
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-12 pt-8 text-xs">
        <div className="text-center space-y-12">
          <span className="text-slate-400 block">Diterima Oleh,</span>
          <div>
            <span className="font-bold text-slate-900 block underline">{slip.employeeName}</span>
            <span className="text-[10px] text-slate-400">Karyawan</span>
          </div>
        </div>
        <div className="text-center space-y-12">
          <span className="text-slate-400 block">Disahkan Oleh,</span>
          <div>
            <span className="font-bold text-slate-900 block underline">{slip.approvedBy || approvedByFallback}</span>
            <span className="text-[10px] text-slate-400">Finance & HR Manager</span>
          </div>
        </div>
      </div>

      {/* Footer Notes */}
      <div className="text-center text-[9px] text-slate-400 pt-8 border-t border-slate-100">
        PT Velox Solusi Nusantara • Slip gaji ini sah diterbitkan secara digital oleh VeloxPay dan tidak memerlukan tanda tangan basah fisik. Status pembayaran dicatat berdasarkan konfirmasi manual admin, bukan hasil transaksi yang diproses VeloxPay.
      </div>
    </div>
  );
};
