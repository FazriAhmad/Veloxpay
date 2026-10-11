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
  role          TEXT NOT NULL CHECK (role IN ('admin', 'finance', 'approver', 'employee')),
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

-- Note: this table's immutability rules (below) mean the company_id CASCADE and
-- user_id SET NULL actions here can never actually fire — harmless today since
-- nothing deletes a company or a user, but revisit if that ever changes.
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

-- Immutability enforced at the database level, not just by omitting UPDATE/DELETE
-- routes — a rule here holds even against a future application bug or a direct
-- psql session using the app's own role. Not applied to notification_log: its
-- slip_id has an ON DELETE CASCADE from payroll_slips, and a blanket no-delete
-- rule would silently swallow that cascade, leaving payroll_slips deletable while
-- its notification rows stay orphaned instead of being cleaned up.
DROP RULE IF EXISTS audit_logs_no_update ON audit_logs;
DROP RULE IF EXISTS audit_logs_no_delete ON audit_logs;
CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_slips_company ON payroll_slips(company_id);
CREATE INDEX IF NOT EXISTS idx_slips_employee ON payroll_slips(employee_id);

-- One slip per employee per month, enforced by the database. The route used to
-- check this with a SELECT before the INSERT, so two quick requests (a double click
-- is enough) could both pass the check and both insert.
CREATE UNIQUE INDEX IF NOT EXISTS payroll_slips_company_employee_month_key
  ON payroll_slips (company_id, employee_id, month);
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_notification_company ON notification_log(company_id);

-- Maker-checker: 'finance' prepares slips, 'approver' approves/pays them. The CHECK above is
-- only applied to new databases, so widen it on existing ones too.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'finance', 'approver', 'employee'));

-- Who created the slip (users.id; NULL for slips made before this column existed).
ALTER TABLE payroll_slips ADD COLUMN IF NOT EXISTS created_by TEXT;

-- When on, the user who created a slip cannot approve it. Off by default so a company with a
-- single admin can still run payroll.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS require_separate_approver BOOLEAN NOT NULL DEFAULT false;

-- An employee proposes their own attendance/overtime for a month; an admin or approver accepts it,
-- and only then does it overwrite the attendance row that payroll reads.
CREATE TABLE IF NOT EXISTS attendance_requests (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id     TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month           TEXT NOT NULL,
  present         INT NOT NULL,
  sick            INT NOT NULL,
  leave           INT NOT NULL,
  alpha           INT NOT NULL,
  overtime_hours  NUMERIC NOT NULL,
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  decided_by      TEXT,
  decision_note   TEXT,
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One open request per employee and month; the database decides, not a prior SELECT.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_requests_one_pending
  ON attendance_requests (employee_id, month) WHERE status = 'Pending';

-- Receipt confirmation. "Paid" is the officer's claim that a transfer happened outside VeloxPay; the
-- employee then confirms or disputes it. Kept apart from `status` so the approval flow is unchanged.
ALTER TABLE payroll_slips ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE payroll_slips ADD COLUMN IF NOT EXISTS receipt_status TEXT
  CHECK (receipt_status IN ('Awaiting', 'Received', 'Disputed'));
ALTER TABLE payroll_slips ADD COLUMN IF NOT EXISTS receipt_at TIMESTAMPTZ;
ALTER TABLE payroll_slips ADD COLUMN IF NOT EXISTS dispute_note TEXT;
ALTER TABLE payroll_slips ADD COLUMN IF NOT EXISTS resolution_note TEXT;
UPDATE payroll_slips SET receipt_status = 'Awaiting' WHERE status = 'Paid' AND receipt_status IS NULL;

-- Notifications now cover everything that needs somebody's action, not only the payslip email.
-- recipient_employee_id is set only when the recipient is that employee, which is what lets an
-- employee see their own rows and nobody else's.
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS recipient_employee_id TEXT;
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS kind TEXT;
UPDATE notification_log n SET recipient_employee_id = s.employee_id
  FROM payroll_slips s WHERE n.slip_id = s.id AND n.recipient_employee_id IS NULL;
UPDATE notification_log SET kind = 'payslip_paid' WHERE kind IS NULL;
