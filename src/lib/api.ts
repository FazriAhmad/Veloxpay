import { Employee, Attendance, SalaryComponent, PayrollSlip, AuditLog, NotificationLogEntry } from './mockData';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001';
const TOKEN_KEY = 'velox_token';

export interface AuthUser {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  employeeId?: string;
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Permintaan gagal (${res.status}).`);
  return body as T;
}

const post = <T,>(path: string, data: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(data) });
const put = <T,>(path: string, data: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(data) });
const patch = <T,>(path: string, data: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(data) });

export const api = {
  login: (email: string, password: string) =>
    post<{ token: string; user: AuthUser }>('/auth/login', { email, password }),
  me: () => request<AuthUser>('/auth/me'),

  listEmployees: () => request<Employee[]>('/employees'),
  createEmployee: (emp: Omit<Employee, 'id' | 'joinDate'>) =>
    post<Employee & { warnings?: string[] }>('/employees', emp),
  updateEmployee: (emp: Employee) => put<Employee>(`/employees/${emp.id}`, emp),
  deleteEmployee: (id: string) => request<void>(`/employees/${id}`, { method: 'DELETE' }),
  getThr: (employeeId: string) => request<{ employeeName: string; amount: number }>(`/employees/${employeeId}/thr`),

  listComponents: () => request<SalaryComponent[]>('/components'),
  createComponent: (comp: Omit<SalaryComponent, 'id' | 'isEditable'>) =>
    post<SalaryComponent>('/components', comp),
  updateComponent: (comp: SalaryComponent) => put<SalaryComponent>(`/components/${comp.id}`, comp),
  deleteComponent: (id: string) => request<void>(`/components/${id}`, { method: 'DELETE' }),

  listAttendance: () => request<Attendance[]>('/attendance'),
  saveAttendance: (att: Attendance) =>
    put<Attendance>(`/attendance/${att.employeeId}/${att.month}`, att),

  listSlips: () => request<PayrollSlip[]>('/slips'),
  createSlip: (slip: Omit<PayrollSlip, 'id' | 'generatedAt'>) =>
    post<PayrollSlip & { warnings?: string[] }>('/slips', slip),
  updateSlipStatus: (id: string, status: PayrollSlip['status']) =>
    patch<PayrollSlip>(`/slips/${id}/status`, { status }),
  deleteSlip: (id: string) => request<void>(`/slips/${id}`, { method: 'DELETE' }),
  // Blob response, not JSON — bypasses `request` and attaches the auth header directly.
  downloadSlipPdf: async (id: string): Promise<Blob> => {
    const res = await fetch(`${BASE_URL}/slips/${id}/pdf`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error(`Gagal mengunduh PDF (${res.status}).`);
    return res.blob();
  },

  listAuditLogs: () => request<AuditLog[]>('/audit-logs'),
  listNotifications: () => request<NotificationLogEntry[]>('/notifications'),
};
