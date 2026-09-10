# VeloxPay

Platform slip gaji digital untuk tim HR/Finance perusahaan kecil-menengah di Indonesia. VeloxPay menghitung, menyetujui, dan menerbitkan slip gaji karyawan — **bukan sistem pembayaran**: transfer gaji tetap dilakukan lewat rekening bank perusahaan di luar aplikasi, admin cukup menandai slip sebagai "Sudah Dibayar" setelahnya.

Lihat [PRD & roadmap produk](https://claude.ai/code/artifact/1e795e32-83fe-4db4-bc78-cd47eb0b42a4) untuk status setiap fase dan apa yang sedang dikerjakan.

## Stack

- React 19 + TypeScript, Vite 7
- Tailwind CSS 4 (`@tailwindcss/vite`)
- framer-motion untuk transisi
- Flaticon Uicons untuk ikon

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Build produksi: `npm run build`. Lint: `npm run lint`.

## Struktur

```
src/
  components/       # LandingPage, V1_Payslip, V2_Management, V3_Automation, dst.
  lib/mockData.ts   # Tipe data & data contoh
  lib/format.ts     # Util format mata uang
```

## Status saat ini

Frontend berjalan penuh dengan data contoh (localStorage). Backend, autentikasi, dan mesin kepatuhan pajak/BPJS sedang dibangun bertahap — lihat PRD di atas untuk detail tiap fase.
