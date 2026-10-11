// Sidebar sub-menu. Each module's pages used to be a tab row inside the page; they live here now
// so every page is one click away from anywhere. `show` mirrors what the page itself renders
// (the server enforces the real permissions).
export type Role = 'admin' | 'finance' | 'approver' | 'employee';
export type ModuleId = 'v1' | 'v2' | 'v3';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  show: (role: Role) => boolean;
}

const staff = (r: Role) => r !== 'employee';
const preparer = (r: Role) => r === 'admin' || r === 'finance';
const always = () => true;

export const NAV: Record<ModuleId, NavItem[]> = {
  v1: [
    { id: 'employees', label: 'Data Karyawan', icon: 'fi-rr-users-alt', show: staff },
    { id: 'input', label: 'Input Payroll', icon: 'fi-rr-calculator-money', show: preparer },
    { id: 'history', label: 'Riwayat Slip', icon: 'fi-rr-receipt', show: always },
  ],
  v2: [
    { id: 'dashboard', label: 'Dashboard', icon: 'fi-rr-chart-pie-alt', show: always },
    { id: 'requests', label: 'Pengajuan Absensi', icon: 'fi-rr-calendar-clock', show: (r) => r === 'employee' },
    { id: 'components', label: 'Komponen Gaji', icon: 'fi-rr-settings-sliders', show: staff },
    { id: 'attendance', label: 'Absensi & Lembur', icon: 'fi-rr-calendar-clock', show: preparer },
    { id: 'approval', label: 'Persetujuan', icon: 'fi-rr-badge-check', show: staff },
    { id: 'reports', label: 'Laporan', icon: 'fi-rr-document-signed', show: staff },
  ],
  v3: [
    { id: 'scheduler', label: 'Penjadwalan', icon: 'fi-rr-calendar-clock', show: staff },
    { id: 'payment-status', label: 'Status Pembayaran', icon: 'fi-rr-credit-card', show: staff },
    { id: 'emails', label: 'Log Notifikasi Email', icon: 'fi-rr-envelope', show: always },
    { id: 'audit', label: 'Log Audit', icon: 'fi-rr-shield-check', show: (r) => r === 'admin' },
    { id: 'roles', label: 'Peran & Izin', icon: 'fi-rr-key', show: (r) => r === 'admin' },
  ],
};

export const visibleItems = (module: ModuleId, role: Role) => NAV[module].filter((i) => i.show(role));

// The remembered page if this role may still see it, otherwise the first page it can see.
export const resolveSubTab = (module: ModuleId, role: Role, remembered?: string) => {
  const items = visibleItems(module, role);
  return items.find((i) => i.id === remembered)?.id ?? items[0].id;
};
