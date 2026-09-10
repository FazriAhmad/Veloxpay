-- VeloxPay schema. Plain SQL, run via `npm run migrate`.
-- Scope: digital payslip records only — no money movement is modeled or executed here.

CREATE TABLE IF NOT EXISTS companies (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
  employee_id   TEXT, -- set when role = 'employee', links to employees.id
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT,
  role            TEXT NOT NULL,
  department      TEXT NOT NULL,
  base_salary     NUMERIC NOT NULL,
  bank_name       TEXT,
  bank_account    TEXT,
  join_date       DATE NOT NULL,
  -- PTKP status per DJP (e.g. TK/0, TK/1, K/0, K/1, K/2, K/3) — drives the
  -- non-taxable income threshold in the PPh 21 calculation. Defaults to the
  -- most common case (single, no dependents) for existing rows.
  ptkp_status     TEXT NOT NULL DEFAULT 'TK/0',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE employees ADD COLUMN IF NOT EXISTS ptkp_status TEXT NOT NULL DEFAULT 'TK/0';

CREATE TABLE IF NOT EXISTS salary_components (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('allowance', 'deduction')),
  calc_method   TEXT NOT NULL CHECK (calc_method IN ('fixed', 'percentage')),
  value         NUMERIC NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  is_editable   BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  employee_id     TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month           TEXT NOT NULL, -- 'YYYY-MM'
  present         INT NOT NULL DEFAULT 0,
  sick            INT NOT NULL DEFAULT 0,
  leave           INT NOT NULL DEFAULT 0,
  alpha           INT NOT NULL DEFAULT 0,
  overtime_hours  NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (employee_id, month)
);

CREATE TABLE IF NOT EXISTS payroll_slips (
  id                    TEXT PRIMARY KEY,
  company_id            TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id           TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  -- Denormalized snapshot of the employee at generation time, so a later name/role
  -- change doesn't rewrite history on an already-issued slip.
  employee_name         TEXT NOT NULL,
  employee_role         TEXT NOT NULL,
  employee_department   TEXT NOT NULL,
  bank_name             TEXT,
  bank_account          TEXT,
  month                 TEXT NOT NULL, -- 'YYYY-MM'
  base_salary           NUMERIC NOT NULL,
  overtime_hours        NUMERIC NOT NULL DEFAULT 0,
  overtime_pay          NUMERIC NOT NULL DEFAULT 0,
  allowances            JSONB NOT NULL DEFAULT '[]',
  deductions            JSONB NOT NULL DEFAULT '[]',
  gross_salary          NUMERIC NOT NULL,
  net_salary            NUMERIC NOT NULL,
  -- status lifecycle: Draft -> Approved -> Paid. "Paid" is a manual admin
  -- confirmation that payment happened outside VeloxPay — never a transaction
  -- this system executes.
  status                TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending Approval', 'Approved', 'Paid')),
  approved_by           TEXT,
  payment_date          DATE,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Real record of every email delivery attempt (payslip notifications). Distinct from
-- audit_logs (which record admin actions) — this is specifically what was sent to
-- whom and whether it worked, honestly marked 'skipped' when SMTP isn't configured
-- rather than pretending an email went out.
CREATE TABLE IF NOT EXISTS notification_log (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  slip_id       TEXT REFERENCES payroll_slips(id) ON DELETE CASCADE,
  to_email      TEXT NOT NULL,
  subject       TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  detail        TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_name    TEXT NOT NULL,
  actor_role    TEXT NOT NULL,
  action        TEXT NOT NULL,
  details       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_slips_company ON payroll_slips(company_id);
CREATE INDEX IF NOT EXISTS idx_slips_employee ON payroll_slips(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_notification_company ON notification_log(company_id);
