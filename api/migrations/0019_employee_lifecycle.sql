-- 従業員ライフサイクルの正本。旧 current-state 列は互換投影として保持する。

ALTER TABLE employees ADD COLUMN archived_at INTEGER;
ALTER TABLE employees ADD COLUMN archived_by_account_id INTEGER;

ALTER TABLE org_departments ADD COLUMN archived_at INTEGER;
ALTER TABLE org_departments ADD COLUMN archived_by_account_id INTEGER;

CREATE TABLE personnel_actions (
  id TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'hire',
    'rehire',
    'primary_assignment_started',
    'transferred',
    'concurrent_assignment_started',
    'assignment_ended',
    'position_changed',
    'manager_changed',
    'department_responsibility_started',
    'department_responsibility_ended',
    'leave_started',
    'returned',
    'retired',
    'corrected',
    'legacy_baseline'
  )),
  event_on TEXT NOT NULL CHECK (
    length(event_on) = 10 AND substr(event_on, 5, 1) = '-' AND substr(event_on, 8, 1) = '-'
  ),
  recorded_at INTEGER NOT NULL,
  recorded_by_account_id INTEGER,
  requested_by_employee_id INTEGER,
  source_type TEXT NOT NULL CHECK (source_type IN ('application', 'direct', 'migration', 'system')),
  source_application_id INTEGER,
  corrects_action_id TEXT,
  operation_id TEXT NOT NULL UNIQUE CHECK (length(operation_id) BETWEEN 1 AND 200),
  payload_fingerprint TEXT NOT NULL CHECK (length(payload_fingerprint) = 64),
  summary_json TEXT NOT NULL CHECK (json_valid(summary_json)),
  CHECK (
    (source_type = 'application' AND source_application_id IS NOT NULL)
    OR (source_type != 'application' AND source_application_id IS NULL)
  ),
  CHECK (corrects_action_id IS NULL OR corrects_action_id != id)
);

CREATE INDEX idx_personnel_actions_employee_timeline
  ON personnel_actions (employee_id, event_on DESC, recorded_at DESC, id DESC);
CREATE UNIQUE INDEX uq_personnel_actions_source_application
  ON personnel_actions (source_application_id)
  WHERE source_application_id IS NOT NULL;
CREATE UNIQUE INDEX uq_personnel_actions_correction
  ON personnel_actions (corrects_action_id)
  WHERE corrects_action_id IS NOT NULL;

CREATE TRIGGER personnel_actions_no_update
BEFORE UPDATE ON personnel_actions
BEGIN
  SELECT RAISE(ABORT, 'personnel_actions is append-only');
END;

CREATE TRIGGER personnel_actions_no_delete
BEFORE DELETE ON personnel_actions
BEGIN
  SELECT RAISE(ABORT, 'personnel_actions is append-only');
END;

CREATE TABLE employment_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  employee_id INTEGER NOT NULL,
  starts_on TEXT NOT NULL CHECK (
    length(starts_on) = 10 AND substr(starts_on, 5, 1) = '-' AND substr(starts_on, 8, 1) = '-'
  ),
  ends_on TEXT CHECK (
    ends_on IS NULL OR (
      length(ends_on) = 10 AND substr(ends_on, 5, 1) = '-' AND substr(ends_on, 8, 1) = '-'
    )
  ),
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY (period_id, revision),
  CHECK (ends_on IS NULL OR starts_on < ends_on)
) WITHOUT ROWID;

CREATE INDEX idx_employment_period_versions_employee
  ON employment_period_versions (employee_id, starts_on, ends_on, period_id, revision DESC);

CREATE TRIGGER employment_period_versions_no_update
BEFORE UPDATE ON employment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'employment_period_versions is append-only');
END;

CREATE TRIGGER employment_period_versions_no_delete
BEFORE DELETE ON employment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'employment_period_versions is append-only');
END;

CREATE TABLE employee_status_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  employment_period_id TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'leave')),
  starts_on TEXT NOT NULL CHECK (
    length(starts_on) = 10 AND substr(starts_on, 5, 1) = '-' AND substr(starts_on, 8, 1) = '-'
  ),
  ends_on TEXT CHECK (
    ends_on IS NULL OR (
      length(ends_on) = 10 AND substr(ends_on, 5, 1) = '-' AND substr(ends_on, 8, 1) = '-'
    )
  ),
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY (period_id, revision),
  CHECK (ends_on IS NULL OR starts_on < ends_on)
) WITHOUT ROWID;

CREATE INDEX idx_employee_status_period_versions_employee
  ON employee_status_period_versions
    (employee_id, starts_on, ends_on, period_id, revision DESC);
CREATE INDEX idx_employee_status_period_versions_employment
  ON employee_status_period_versions (employment_period_id, period_id, revision DESC);

CREATE TRIGGER employee_status_period_versions_no_update
BEFORE UPDATE ON employee_status_period_versions
BEGIN
  SELECT RAISE(ABORT, 'employee_status_period_versions is append-only');
END;

CREATE TRIGGER employee_status_period_versions_no_delete
BEFORE DELETE ON employee_status_period_versions
BEGIN
  SELECT RAISE(ABORT, 'employee_status_period_versions is append-only');
END;

CREATE TABLE org_assignment_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  employment_period_id TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  department_code TEXT NOT NULL,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('primary', 'concurrent')),
  position_title TEXT,
  manager_employee_id INTEGER,
  starts_on TEXT NOT NULL CHECK (
    length(starts_on) = 10 AND substr(starts_on, 5, 1) = '-' AND substr(starts_on, 8, 1) = '-'
  ),
  ends_on TEXT CHECK (
    ends_on IS NULL OR (
      length(ends_on) = 10 AND substr(ends_on, 5, 1) = '-' AND substr(ends_on, 8, 1) = '-'
    )
  ),
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY (period_id, revision),
  CHECK (ends_on IS NULL OR starts_on < ends_on),
  CHECK (manager_employee_id IS NULL OR manager_employee_id != employee_id)
) WITHOUT ROWID;

CREATE INDEX idx_org_assignment_period_versions_employee
  ON org_assignment_period_versions
    (employee_id, starts_on, ends_on, assignment_type, period_id, revision DESC);
CREATE INDEX idx_org_assignment_period_versions_department
  ON org_assignment_period_versions
    (department_code, starts_on, ends_on, period_id, revision DESC);

CREATE TRIGGER org_assignment_period_versions_no_update
BEFORE UPDATE ON org_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'org_assignment_period_versions is append-only');
END;

CREATE TRIGGER org_assignment_period_versions_no_delete
BEFORE DELETE ON org_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'org_assignment_period_versions is append-only');
END;

CREATE TABLE org_responsibility_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  department_code TEXT NOT NULL,
  responsibility_type TEXT NOT NULL CHECK (responsibility_type = 'department_manager'),
  employee_id INTEGER NOT NULL,
  starts_on TEXT NOT NULL CHECK (
    length(starts_on) = 10 AND substr(starts_on, 5, 1) = '-' AND substr(starts_on, 8, 1) = '-'
  ),
  ends_on TEXT CHECK (
    ends_on IS NULL OR (
      length(ends_on) = 10 AND substr(ends_on, 5, 1) = '-' AND substr(ends_on, 8, 1) = '-'
    )
  ),
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY (period_id, revision),
  CHECK (ends_on IS NULL OR starts_on < ends_on)
) WITHOUT ROWID;

CREATE INDEX idx_org_responsibility_period_versions_department
  ON org_responsibility_period_versions
    (department_code, responsibility_type, starts_on, ends_on, period_id, revision DESC);
CREATE INDEX idx_org_responsibility_period_versions_employee
  ON org_responsibility_period_versions
    (employee_id, starts_on, ends_on, period_id, revision DESC);

CREATE TRIGGER org_responsibility_period_versions_no_update
BEFORE UPDATE ON org_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'org_responsibility_period_versions is append-only');
END;

CREATE TRIGGER org_responsibility_period_versions_no_delete
BEFORE DELETE ON org_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'org_responsibility_period_versions is append-only');
END;

CREATE TABLE employee_lifecycle_revisions (
  employee_id INTEGER PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at INTEGER NOT NULL
);

CREATE TABLE organization_lifecycle_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at INTEGER NOT NULL
);

INSERT INTO organization_lifecycle_state (id, revision, updated_at)
VALUES (1, 0, 0);

CREATE TABLE personnel_action_requests (
  id TEXT PRIMARY KEY,
  application_id INTEGER NOT NULL UNIQUE,
  target_employee_id INTEGER,
  kind TEXT NOT NULL CHECK (kind IN (
    'hire',
    'rehire',
    'primary_assignment_started',
    'transferred',
    'concurrent_assignment_started',
    'assignment_ended',
    'position_changed',
    'manager_changed',
    'department_responsibility_started',
    'department_responsibility_ended',
    'leave_started',
    'returned',
    'retired',
    'corrected'
  )),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  requested_by_employee_id INTEGER NOT NULL,
  base_employee_revision INTEGER CHECK (
    base_employee_revision IS NULL OR base_employee_revision >= 0
  ),
  base_organization_revision INTEGER CHECK (
    base_organization_revision IS NULL OR base_organization_revision >= 0
  ),
  created_at INTEGER NOT NULL,
  applied_action_id TEXT
);

CREATE UNIQUE INDEX uq_personnel_action_requests_applied_action
  ON personnel_action_requests (applied_action_id)
  WHERE applied_action_id IS NOT NULL;
CREATE INDEX idx_personnel_action_requests_target
  ON personnel_action_requests (target_employee_id, created_at DESC);

CREATE TABLE application_subjects (
  application_id INTEGER PRIMARY KEY,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('employee', 'prospective_employee')),
  subject_employee_id INTEGER,
  subject_snapshot_json TEXT CHECK (
    subject_snapshot_json IS NULL OR json_valid(subject_snapshot_json)
  ),
  target_department_code TEXT,
  CHECK (
    (subject_type = 'employee' AND subject_employee_id IS NOT NULL)
    OR (
      subject_type = 'prospective_employee'
      AND subject_employee_id IS NULL
      AND subject_snapshot_json IS NOT NULL
    )
  )
);

CREATE INDEX idx_application_subjects_employee
  ON application_subjects (subject_employee_id)
  WHERE subject_employee_id IS NOT NULL;

CREATE TABLE application_completion_bindings (
  application_id INTEGER PRIMARY KEY,
  handler_key TEXT NOT NULL CHECK (handler_key = 'personnel_action'),
  resource_id TEXT NOT NULL,
  payload_fingerprint TEXT NOT NULL CHECK (length(payload_fingerprint) = 64),
  created_at INTEGER NOT NULL
);

CREATE TABLE lifecycle_migration_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL CHECK (status IN ('pending', 'backfilled', 'verified')),
  baseline_on TEXT,
  company_time_zone TEXT,
  legacy_source_fingerprint TEXT,
  employee_count INTEGER NOT NULL DEFAULT 0 CHECK (employee_count >= 0),
  department_count INTEGER NOT NULL DEFAULT 0 CHECK (department_count >= 0),
  backfilled_at INTEGER,
  verified_at INTEGER,
  CHECK (
    baseline_on IS NULL OR (
      length(baseline_on) = 10
      AND substr(baseline_on, 5, 1) = '-'
      AND substr(baseline_on, 8, 1) = '-'
    )
  )
);

INSERT INTO lifecycle_migration_state
  (id, status, employee_count, department_count)
VALUES (1, 'pending', 0, 0);

CREATE TABLE lifecycle_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personnel_action_id TEXT NOT NULL,
  effect_type TEXT NOT NULL CHECK (effect_type IN ('hire', 'retired')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at INTEGER NOT NULL,
  processed_at INTEGER,
  last_error_code TEXT,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX uq_lifecycle_outbox_action_effect
  ON lifecycle_outbox (personnel_action_id, effect_type);
CREATE INDEX idx_lifecycle_outbox_pending
  ON lifecycle_outbox (processed_at, next_attempt_at, id);

CREATE TABLE lifecycle_effect_template_bindings (
  effect_type TEXT PRIMARY KEY CHECK (effect_type IN ('hire', 'retired')),
  template_code TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by_account_id INTEGER
) WITHOUT ROWID;

INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('employee:lifecycle:request', '組織スコープ内の人事変更を申請する', 'employee'),
  ('employee:lifecycle:apply', '許可された対象範囲の人事変更を確定する', 'employee'),
  ('employee:lifecycle:read:all', '全社の人事履歴を横断で閲覧する', 'employee'),
  ('employee:archive', '退職済み従業員をアーカイブする', 'employee');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT role.id, permission.id
  FROM roles role, permissions permission
  WHERE role.key = 'manager'
    AND permission.key = 'employee:lifecycle:request';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT role.id, permission.id
  FROM roles role, permissions permission
  WHERE role.key IN ('hr', 'admin')
    AND permission.key IN (
      'employee:lifecycle:request',
      'employee:lifecycle:apply',
      'employee:lifecycle:read:all',
      'employee:archive'
    );
