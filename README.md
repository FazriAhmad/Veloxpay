# VeloxPay

Platform slip gaji digital untuk tim HR/Finance perusahaan kecil-menengah di Indonesia. VeloxPay menghitung, menyetujui, dan menerbitkan slip gaji karyawan — **bukan sistem pembayaran**: transfer gaji tetap dilakukan lewat rekening bank perusahaan di luar aplikasi, admin cukup menandai slip sebagai "Sudah Dibayar" setelahnya.

Lihat [PRD & roadmap produk](https://claude.ai/code/artifact/1e795e32-83fe-4db4-bc78-cd47eb0b42a4) untuk status setiap fase dan apa yang sedang dikerjakan.

## Stack

- Frontend: React 19 + TypeScript, Vite 7, Tailwind CSS 4, framer-motion, Flaticon Uicons
- Backend: Node.js (plain JS, ES modules) + Express + `pg` langsung ke Postgres — tanpa ORM

## Menjalankan frontend

Backend harus jalan lebih dulu (lihat bagian berikutnya) — frontend mengambil semua datanya dari API.

```bash
npm install
npm run dev
```

Kalau API tidak berada di `http://localhost:4001`, salin `.env.example` jadi `.env` dan sesuaikan `VITE_API_URL`.

Build produksi: `npm run build`. Lint: `npm run lint`.

## Menjalankan backend

Perlu Postgres lokal dengan database bernama `veloxpay` sudah dibuat.

```bash
cd server
npm install
cp .env.example .env   # isi DATABASE_URL & JWT_SECRET sesuai environment Anda
npm run migrate         # buat semua tabel
npm run seed            # isi data contoh + akun login demo
npm run dev             # jalan di http://localhost:4001
```

Akun demo setelah `npm run seed` (ganti passwordnya di luar environment lokal):

| Role     | Email                          | Password        |
|----------|---------------------------------|------------------|
| Admin    | dewi.lestari@veloxpay.co.id    | admin12345       |
| Karyawan | ahmad.subarjo@veloxpay.co.id   | employee12345    |

## Struktur

```
src/
  components/       # LandingPage, V1_Payslip, V2_Management, V3_Automation, dst.
  lib/mockData.ts   # Tipe data & data contoh
  lib/format.ts     # Util format mata uang
server/
  routes/           # auth, users, employees, components, attendance, slips, audit-logs
  schema.sql        # Skema Postgres (companies, users, employees, salary_components,
                     # attendance, payroll_slips, audit_logs — semua multi-tenant per company_id)
```

## Status saat ini

Fase 1 selesai: frontend dan backend sudah tersambung penuh. Login memakai email/password sungguhan, seluruh data karyawan/komponen gaji/absensi/slip/audit log tersimpan di Postgres, dan role admin vs karyawan ditegakkan di server — bukan sekadar disembunyikan di UI.

Belum ada: perhitungan PPh 21 & BPJS resmi (Fase 2), generate PDF server-side dan pengiriman email nyata (Fase 3), enkripsi data sensitif (Fase 4), serta test otomatis (Fase 5). Penjadwalan dan kotak masuk email di modul V3 masih simulasi lokal. Lihat PRD di atas untuk detail tiap fase.
