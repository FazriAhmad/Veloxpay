# VeloxPay

Platform payroll digital untuk tim HR/Finance perusahaan kecil-menengah di Indonesia. VeloxPay menghitung slip gaji, memprosesnya lewat persetujuan dua orang, menerbitkannya sebagai PDF, lalu meminta karyawan mengonfirmasi bahwa gajinya diterima — **bukan sistem pembayaran**: transfer gaji tetap dilakukan lewat rekening bank perusahaan di luar aplikasi. Petugas hanya mencatat nomor referensi transfernya dan menandai slip "Sudah Dibayar".

Lihat [PRD & roadmap produk](https://claude.ai/code/artifact/1e795e32-83fe-4db4-bc78-cd47eb0b42a4) untuk status setiap fase.

## Stack

- Frontend: React 19 + TypeScript, Vite 7, Tailwind CSS 4, framer-motion, Flaticon Uicons
- Backend: Node.js (plain JS, ES modules) + Express + `pg` langsung ke Postgres — tanpa ORM

## Peran dan alur

| Peran | Bisa | Tidak bisa |
|---|---|---|
| `admin` | Semuanya: kelola karyawan dan komponen gaji, buat login (karyawan dan staf), buat/setujui/bayar slip, putuskan pengajuan absensi, tanggapi laporan, ubah pengaturan, lihat log audit | Menyetujui slip buatannya sendiri bila aturan pemisahan dinyalakan |
| `finance` (Keuangan) | Isi absensi, buat slip (draf), ajukan slip, hapus draf | Menyetujui, menandai dibayar, kelola akun, lihat log audit |
| `approver` (Penyetuju) | Setujui atau tolak slip dan pengajuan absensi, tandai dibayar dengan nomor referensi, tanggapi laporan karyawan | Membuat slip, mengubah data karyawan |
| `employee` (Karyawan) | Lihat slip dan notifikasi sendiri, ajukan absensi/lembur, konfirmasi atau laporkan penerimaan gaji | Semua yang lain; hanya melihat data miliknya |

Siklus slip: `Draft → Pending Approval → Approved → Paid`. Paid bersifat final. Setiap perpindahan status bersyarat pada status yang tadi diperiksa, jadi dua klik bersamaan tidak menghasilkan dua email atau dua pembayaran.

1. **Menyiapkan** — Keuangan memilih karyawan dan bulan. Server membaca gaji, rekening, dan status PTKP dari data karyawan (bukan dari request), mengambil lembur dari absensi bulan itu yang sudah disetujui, menghitung PPh 21 dan BPJS, lalu menyimpan draf. Satu slip per karyawan per bulan dijaga indeks unik di database.
2. **Menyetujui** — slip diajukan, penyetuju/admin diberi tahu dan menyetujui. Aturan opsional per perusahaan (`Peran & Izin`) melarang pembuat slip menyetujui slipnya sendiri; matikan hanya bila perusahaan hanya punya satu orang berwenang.
3. **Membayar** — setelah transfer dilakukan di luar sistem, penyetuju mengisi nomor referensi per slip dan menandai Paid. PDF dikirim ke karyawan.
4. **Mengonfirmasi** — karyawan menekan "Sudah Diterima" (final) atau "Belum Diterima" dengan alasan. Laporan masuk ke petugas, yang menanggapinya (opsional dengan referensi transfer baru); karyawan lalu mengonfirmasi lagi.

Pengajuan absensi: karyawan memilih status tiap hari (hadir, sakit, cuti, alpha, libur, plus jam lembur) dan mengirim total bulanan. Admin atau penyetuju memutuskan; hanya yang disetujui yang menimpa data absensi payroll. Satu pengajuan terbuka per karyawan per bulan.

Notifikasi: semua yang menunggu tindakan (slip perlu disetujui, siap dibayar, dikembalikan, pengajuan absensi, laporan penerimaan, tanggapan petugas) dicatat di **Log Notifikasi Email** dan dikirim lewat email bila SMTP diatur. Tanpa SMTP statusnya jujur "dilewati". Karyawan hanya melihat email yang ditujukan kepadanya.

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
npm run migrate         # buat/ubah semua tabel (aman dijalankan berulang)
npm run seed            # isi data contoh + akun login demo (aman dijalankan berulang)
npm run dev             # jalan di http://localhost:4001
npm test                # unit + integration test (server/test/) — perlu DB nyala
```

`ENCRYPTION_KEY` wajib diisi (64 karakter hex) — generate dengan:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Email nyata butuh `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, dan `MAIL_FROM` di `server/.env`. Kosongkan `SMTP_HOST` untuk melewati pengiriman (dicatat sebagai "dilewati").

### Akun demo

Setelah `npm run seed`, halaman login punya tombol satu klik untuk tiap peran. Kredensialnya:

| Peran     | Email                          | Password        |
|-----------|---------------------------------|------------------|
| Admin     | dewi.lestari@veloxpay.co.id    | admin12345       |
| Keuangan  | finance@veloxpay.co.id         | staff12345       |
| Penyetuju | approver@veloxpay.co.id        | staff12345       |
| Karyawan  | ahmad.subarjo@veloxpay.co.id   | employee12345    |

Password ini tertulis di kode dan tampil di halaman login. **Hanya untuk lokal/demo:** jangan jalankan `seed` pada data nyata, dan ganti atau hapus tombol demo bila aplikasi dipasang di internet.

Login untuk karyawan baru dibuat admin: isi "Password Login Karyawan" di form tambah karyawan, atau klik ikon kunci di barisnya. Akun Keuangan dan Penyetuju dibuat lewat `POST /users` dengan `role` dan `name` (belum ada form di UI).

## Struktur

```
src/
  components/       # LandingPage, LoginPage, V1_Payslip, V2_Management, V3_Automation,
                     # AttendanceRequests, FormDialog, ReceiptBadge, dst.
  lib/navigation.ts # Menu sidebar per peran
  lib/api.ts        # Klien API; lib/mockData.ts berisi tipe data
server/
  routes/           # auth, users, employees, components, attendance, attendance-requests,
                     # slips, notifications, settings, audit-logs
  slipRules.js      # Aturan murni: validasi nominal, status slip, siapa boleh apa
  attendanceRules.js# Validasi pengajuan absensi
  notify.js         # Penerima + log + email untuk semua notifikasi
  payrollEngine.js  # PPh 21, BPJS, THR, upah minimum
  schema.sql        # Skema Postgres (multi-tenant per company_id), idempoten
```

## Testing & CI

- Backend: `cd server && npm test` — 84 tes (`node:test`). Unit test untuk mesin payroll, aturan slip/absensi, PDF, mailer, enkripsi; integration test (`supertest`) yang menjalankan alur penuh lewat HTTP, termasuk matriks peran, pemisahan pembuat dan penyetuju, request bersamaan (dua pembayaran/konfirmasi/pengajuan serentak: satu menang), validasi nominal, dan isolasi data antar karyawan. Butuh Postgres nyala.
- Frontend: `npm test` — 10 tes (`vitest`) untuk util format, klien API, dan komponen `PayslipDocument`. Belum ada tes untuk komponen baru.
- `.github/workflows/ci.yml` menjalankan keduanya di setiap push/PR ke `main`/`dev`, dengan Postgres sebagai service container. CI belum menjalankan lint.

## Deployment

Belum di-deploy ke mana pun — berikut yang sudah disiapkan agar deployment tinggal eksekusi:

- `Dockerfile` (frontend, build statis lalu disajikan nginx) dan `server/Dockerfile` (backend Node) sudah ada. Build manual:
  ```bash
  docker build -t veloxpay-web .
  docker build -t veloxpay-api ./server
  ```
- Untuk produksi sungguhan, siapkan sendiri (butuh akun):
  - Database Postgres terkelola (mis. Railway, Supabase, RDS).
  - Set `NODE_ENV=production`, `ALLOWED_ORIGINS` ke domain frontend, `SMTP_*` untuk email nyata, dan **simpan `ENCRYPTION_KEY` dengan aman** — kunci yang hilang membuat data rekening bank terenkripsi tak bisa dipulihkan.
  - Reverse proxy/hosting dengan TLS (redirect HTTPS sudah ada di kode saat `NODE_ENV=production`).
- Monitoring: baru logging request dasar (`morgan`). Belum ada error tracker.

## Status dan batasan yang diketahui

Fase 0–5 (backend nyata, RBAC, PPh 21/BPJS/THR, PDF dan email, enkripsi rekening, audit log tak bisa diubah, CI) selesai. Berikutnya ditambahkan: peran Keuangan dan Penyetuju dengan aturan pemisahan tugas, pengajuan absensi oleh karyawan, referensi transfer per slip dengan konfirmasi penerimaan, notifikasi untuk semua yang menunggu tindakan, dan navigasi sidebar per peran.

Batasan yang perlu diketahui sebelum dipakai sungguhan:

- **PPh 21 masih estimasi.** Memakai pendekatan progresif disetahunkan, bukan tarif TER resmi (PMK 168/2023). Batas JP di mesin masih angka lama, lembur dihitung flat 1,5× (aturan sebenarnya berjenjang), dan lembur ikut dasar pajak. Upah minimum satu angka nasional, bukan UMR/UMK per daerah.
- **Akun tidak bisa dihapus.** Aturan database yang menolak perubahan log audit berbenturan dengan foreign key `audit_logs.user_id`. Belum ada fitur menonaktifkan akun, ganti password, atau reset password, dan token login (8 jam) tidak bisa dicabut.
- **Absensi per hari tidak disimpan** — hanya totalnya. Penyetuju tidak melihat tanggal mana yang sakit atau cuti.
- **Penjadwalan payroll (V3)** hanya konfigurasi lokal; belum ada yang berjalan terjadwal. Slip dibuat satu per satu, belum massal.
- **Email** hanya terkirim bila SMTP diisi. Hanya satu email per peristiwa; belum ada pengingat berulang.
- Tombol hapus masih memakai `confirm()` bawaan browser, tampilan ponsel belum diuji, dan masih ada beberapa error lint lama.
- Setelah mengisi `ENCRYPTION_KEY` baru, jalankan `node migrateEncryptBankAccounts.js` sekali untuk mengenkripsi data lama.
