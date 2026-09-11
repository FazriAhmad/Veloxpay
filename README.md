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
cp .env.example .env   # isi DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY sesuai environment Anda
npm run migrate         # buat semua tabel
npm run seed            # isi data contoh + akun login demo
npm run dev             # jalan di http://localhost:4001
npm test                # unit + integration test (server/test/) — perlu DB nyala
```

`ENCRYPTION_KEY` wajib diisi (64 karakter hex) — generate dengan:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
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

## Testing & CI

- Backend: `cd server && npm test` — unit test mesin payroll/PDF/mailer/enkripsi (`node:test`) plus satu integration test (`test/integration.test.js`, pakai `supertest`) yang menjalankan alur penuh lewat HTTP: register → tambah karyawan → generate slip → approve → tandai dibayar → verifikasi RBAC 401/403. Butuh Postgres nyala.
- Frontend: `npm test` — unit test (`vitest`) untuk util format, klien API, dan komponen `PayslipDocument`.
- `.github/workflows/ci.yml` menjalankan keduanya otomatis di setiap push/PR ke `main`/`dev`, dengan Postgres sebagai service container untuk backend.

## Deployment

Belum di-deploy ke mana pun — berikut yang sudah disiapkan agar deployment tinggal eksekusi:

- `Dockerfile` (frontend, build statis lalu disajikan nginx) dan `server/Dockerfile` (backend Node) sudah ada. Build manual:
  ```bash
  docker build -t veloxpay-web .
  docker build -t veloxpay-api ./server
  ```
- Untuk produksi sungguhan, siapkan sendiri (butuh akun — di luar yang bisa dilakukan asisten ini):
  - Database Postgres terkelola (mis. Railway, Supabase, RDS).
  - Set `NODE_ENV=production`, `ALLOWED_ORIGINS` ke domain frontend, `SMTP_HOST` dkk untuk email nyata, dan **simpan `ENCRYPTION_KEY` dengan aman** — kunci yang hilang membuat data rekening bank terenkripsi tak bisa dipulihkan.
  - Reverse proxy/hosting dengan TLS (redirect HTTPS otomatis sudah ada di kode saat `NODE_ENV=production`, tinggal pasang sertifikatnya).
- Monitoring/error tracking: baru ada logging request dasar (`morgan`, aktif otomatis saat server jalan). Belum ada APM/error tracker (mis. Sentry) — itu juga perlu akun pihak ketiga.

## Status saat ini

Fase 0–5 selesai. Frontend dan backend tersambung penuh dengan login sungguhan dan RBAC di server (Fase 1). PPh 21, BPJS Kesehatan/JHT/JP, estimasi THR, dan peringatan upah minimum dihitung otomatis di `server/payrollEngine.js` setiap slip diterbitkan (Fase 2). Slip gaji PDF dibuat sungguhan di server (`server/pdf.js`), dan menandai slip "Sudah Dibayar" memicu email asli via SMTP — atau tercatat jujur "dilewati" bila SMTP belum dikonfigurasi (Fase 3). Nomor rekening bank terenkripsi (AES-256-GCM) di database, audit log punya aturan level-database yang menolak diubah/dihapus, rate limiting di endpoint login, dan header keamanan standar via helmet (Fase 4). Lihat `server/test/` untuk unit test-nya.

**Penting:** perhitungan PPh 21 memakai pendekatan progresif disetahunkan, bukan tabel TER resmi DJP (PMK 168/2023) — cukup akurat untuk estimasi, tapi perlu divalidasi/diganti sebelum dipakai pelaporan pajak sungguhan. Upah minimum juga masih satu angka nasional, bukan data UMR/UMK per daerah. Email hanya benar-benar terkirim setelah `SMTP_HOST` dkk diisi di `server/.env`. Setelah mengisi `ENCRYPTION_KEY` baru, jalankan `node migrateEncryptBankAccounts.js` sekali untuk mengenkripsi data lama.

Fase 5 menambahkan integration test end-to-end, unit test frontend, CI otomatis di GitHub Actions, dan Dockerfile untuk kedua sisi — lihat bagian Testing & CI dan Deployment di atas untuk detail, termasuk apa yang masih perlu dilakukan manual (hosting, SMTP, error tracking — semua butuh akun pihak ketiga yang tak bisa dibuatkan otomatis).

Yang belum: penjadwalan otomatis (cron) di modul V3 masih konfigurasi lokal, belum benar-benar dieksekusi terjadwal — masuk backlog. Lihat PRD di atas untuk detail tiap fase.
