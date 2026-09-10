// snake_case DB rows <-> camelCase API shapes matching src/lib/mockData.ts

export const toEmployeeDTO = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  department: r.department,
  baseSalary: Number(r.base_salary),
  bankName: r.bank_name,
  bankAccount: r.bank_account,
  joinDate: r.join_date instanceof Date ? r.join_date.toISOString().slice(0, 10) : r.join_date,
  ptkpStatus: r.ptkp_status,
});

export const toComponentDTO = (r) => ({
  id: r.id,
  name: r.name,
  type: r.type,
  amountType: r.calc_method,
  value: Number(r.value),
  description: r.description,
  isEditable: r.is_editable,
});

export const toAttendanceDTO = (r) => ({
  employeeId: r.employee_id,
  month: r.month,
  present: r.present,
  sick: r.sick,
  leave: r.leave,
  alpha: r.alpha,
  overtimeHours: Number(r.overtime_hours),
});

export const toSlipDTO = (r) => ({
  id: r.id,
  employeeId: r.employee_id,
  employeeName: r.employee_name,
  employeeRole: r.employee_role,
  employeeDepartment: r.employee_department,
  month: r.month,
  baseSalary: Number(r.base_salary),
  bankName: r.bank_name,
  bankAccount: r.bank_account,
  allowances: r.allowances,
  deductions: r.deductions,
  overtimePay: Number(r.overtime_pay),
  overtimeHours: Number(r.overtime_hours),
  grossSalary: Number(r.gross_salary),
  netSalary: Number(r.net_salary),
  status: r.status,
  paymentDate: r.payment_date ? new Date(r.payment_date).toISOString().slice(0, 10) : undefined,
  generatedAt: r.generated_at.toISOString(),
  approvedBy: r.approved_by || undefined,
});

export const toAuditLogDTO = (r) => ({
  id: r.id,
  timestamp: r.created_at.toISOString(),
  user: r.actor_name,
  role: r.actor_role,
  action: r.action,
  details: r.details,
});
