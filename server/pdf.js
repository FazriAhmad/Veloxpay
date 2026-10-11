import PDFDocument from 'pdfkit';

const formatIDR = (num) => `Rp ${Math.round(Number(num)).toLocaleString('id-ID')}`;
const line = (doc, y) => doc.moveTo(40, y).lineTo(555, y).strokeColor('#E2E8F0').stroke();

// Renders one payslip as a PDF buffer, server-side — this is what "Unduh PDF" on the
// slip document actually downloads now, instead of the browser's own print dialog.
export function renderPayslipPdf(slip) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0F172A').text('VeloxPay', 40, 40);
    doc.font('Helvetica').fontSize(8).fillColor('#94A3B8').text('PT VELOX SOLUSI NUSANTARA', 40, 60);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0F172A').text('SLIP GAJI DIGITAL', 0, 40, { align: 'right' });
    doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(`ID Dokumen: ${slip.id}`, { align: 'right' });
    line(doc, 85);

    const statusLabel = slip.status === 'Paid' ? 'SUDAH DIBAYAR' : slip.status === 'Approved' ? 'DISETUJUI' : 'DRAF';
    const monthLabel = new Date(slip.month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    doc.fontSize(9).fillColor('#475569');
    doc.text(`Nama Karyawan: ${slip.employeeName}`, 40, 100);
    doc.text(`ID Karyawan: ${slip.employeeId}`, 40, 115);
    doc.text(`Jabatan / Divisi: ${slip.employeeRole} / ${slip.employeeDepartment}`, 40, 130);
    doc.text(`Periode Gaji: ${monthLabel}`, 320, 100);
    doc.text(`Status Pembayaran: ${statusLabel}`, 320, 115);
    doc.text(`Tanggal Terbit: ${new Date(slip.generatedAt).toLocaleDateString('id-ID')}`, 320, 130);
    line(doc, 155);

    let y = 175;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A').text('1. PENDAPATAN', 40, y);
    y += 18;
    doc.font('Helvetica').fontSize(9).fillColor('#334155');
    doc.text('Gaji Pokok', 40, y);
    doc.text(formatIDR(slip.baseSalary), 0, y, { align: 'right', width: 555 });
    y += 15;
    if (slip.overtimeHours > 0) {
      doc.text(`Lembur (${slip.overtimeHours} jam)`, 40, y);
      doc.text(formatIDR(slip.overtimePay), 0, y, { align: 'right', width: 555 });
      y += 15;
    }
    for (const a of slip.allowances) {
      doc.text(a.name, 40, y);
      doc.text(formatIDR(a.amount), 0, y, { align: 'right', width: 555 });
      y += 15;
    }

    y += 10;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A').text('2. POTONGAN', 40, y);
    y += 18;
    doc.font('Helvetica').fontSize(9).fillColor('#B91C1C');
    if (slip.deductions.length === 0) {
      doc.fillColor('#94A3B8').text('Tidak ada potongan.', 40, y);
      y += 15;
    } else {
      for (const d of slip.deductions) {
        doc.fillColor('#334155').text(d.name, 40, y);
        doc.fillColor('#B91C1C').text(`(${formatIDR(d.amount)})`, 0, y, { align: 'right', width: 555 });
        y += 15;
      }
    }

    y += 10;
    line(doc, y);
    y += 15;
    const deductionTotal = slip.deductions.reduce((sum, d) => sum + Number(d.amount), 0);
    doc.font('Helvetica').fontSize(9).fillColor('#475569').text('Total Pendapatan Kotor', 40, y);
    doc.text(formatIDR(slip.grossSalary), 0, y, { align: 'right', width: 555 });
    y += 15;
    doc.text('Total Potongan', 40, y);
    doc.fillColor('#B91C1C').text(`(${formatIDR(deductionTotal)})`, 0, y, { align: 'right', width: 555 });
    y += 18;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('GAJI BERSIH DITERIMA (THP)', 40, y);
    doc.text(formatIDR(slip.netSalary), 0, y, { align: 'right', width: 555 });
    y += 25;

    doc.font('Helvetica').fontSize(8).fillColor('#94A3B8');
    doc.text(`Rekening tujuan (referensi): ${slip.bankName || '-'} - ${slip.bankAccount || '-'}`, 40, y);
    y += 30;

    doc.fontSize(8).fillColor('#94A3B8').text('Diterima Oleh,', 40, y);
    doc.text('Disahkan Oleh,', 320, y);
    y += 35;
    doc.fontSize(9).fillColor('#0F172A');
    doc.text(slip.employeeName, 40, y, { underline: true });
    doc.text(slip.approvedBy || 'Dewi Lestari', 320, y, { underline: true });

    doc.fontSize(7).fillColor('#94A3B8').text(
      'PT Velox Solusi Nusantara — Slip gaji ini sah diterbitkan secara digital oleh VeloxPay dan tidak memerlukan tanda tangan basah fisik. ' +
        'Status pembayaran dicatat berdasarkan konfirmasi manual admin, bukan hasil transaksi yang diproses VeloxPay.',
      40,
      760,
      { width: 515 }
    );

    doc.end();
  });
}
