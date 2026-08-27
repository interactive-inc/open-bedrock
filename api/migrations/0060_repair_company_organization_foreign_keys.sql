-- Company組織期間の旧table参照をcanonical Company tableへ無損失で付け替える。

PRAGMA foreign_keys = OFF;

DROP TRIGGER IF EXISTS company_organization_unit_period_versions_immutable_delete;
DROP TRIGGER IF EXISTS company_organization_unit_period_versions_immutable_update;
DROP TRIGGER IF EXISTS company_organization_unit_period_versions_revision_guard;
DROP TRIGGER IF EXISTS company_organization_unit_period_versions_revision_state;
DROP TRIGGER IF EXISTS company_organization_assignment_period_versions_guard;
DROP TRIGGER IF EXISTS company_organization_assignment_period_versions_immutable_delete;
DROP TRIGGER IF EXISTS company_organization_assignment_period_versions_immutable_update;
DROP TRIGGER IF EXISTS company_organization_assignment_period_versions_revision_state;
DROP TRIGGER IF EXISTS company_organization_responsibility_period_versions_guard;
DROP TRIGGER IF EXISTS company_organization_responsibility_period_versions_immutable_delete;
DROP TRIGGER IF EXISTS company_organization_responsibility_period_versions_immutable_update;
DROP TRIGGER IF EXISTS company_organization_responsibility_period_versions_revision_state;

CREATE TABLE _company_organization_foreign_key_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0)
);

CREATE TABLE __new_company_organization_unit_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  code TEXT NOT NULL
    CHECK (length(code) BETWEEN 1 AND 64 AND trim(code) = code),
  official_name TEXT NOT NULL
    CHECK (length(official_name) BETWEEN 1 AND 200 AND trim(official_name) = official_name),
  kind TEXT NOT NULL
    CHECK (kind IN ('COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM', 'OTHER')),
  parent_organization_unit_id TEXT
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  ),
  CHECK (
    parent_organization_unit_id IS NULL
    OR parent_organization_unit_id != organization_unit_id
  )
) WITHOUT ROWID;

INSERT INTO __new_company_organization_unit_period_versions
SELECT * FROM company_organization_unit_period_versions;

INSERT INTO _company_organization_foreign_key_validation
SELECT
  'company_organization_unit_period_versions',
  (SELECT count(*) FROM company_organization_unit_period_versions),
  (SELECT count(*) FROM __new_company_organization_unit_period_versions),
  (SELECT count(*)
   FROM __new_company_organization_unit_period_versions period
   LEFT JOIN company_organization_units unit
     ON unit.id = period.organization_unit_id
   LEFT JOIN company_organization_units parent
     ON parent.id = period.parent_organization_unit_id
   LEFT JOIN company_organization_change_operations operation
     ON operation.id = period.recorded_by_action_id
   WHERE unit.id IS NULL
      OR (period.parent_organization_unit_id IS NOT NULL AND parent.id IS NULL)
      OR operation.id IS NULL);

DROP TABLE company_organization_unit_period_versions;
ALTER TABLE __new_company_organization_unit_period_versions
  RENAME TO company_organization_unit_period_versions;

CREATE INDEX company_organization_unit_period_versions_unit_idx
  ON company_organization_unit_period_versions(
    organization_unit_id, starts_on, ends_on, period_id, revision
  );
CREATE INDEX company_organization_unit_period_versions_code_idx
  ON company_organization_unit_period_versions(code, starts_on, ends_on, period_id, revision);
CREATE INDEX company_organization_unit_period_versions_parent_idx
  ON company_organization_unit_period_versions(parent_organization_unit_id, starts_on, ends_on);

CREATE TABLE __new_company_organization_assignment_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  employment_id TEXT NOT NULL CHECK (length(employment_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL CHECK (length(employee_id) BETWEEN 1 AND 128),
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('PRIMARY', 'CONCURRENT')),
  position_title TEXT CHECK (
    position_title IS NULL OR (
      length(position_title) BETWEEN 1 AND 200 AND trim(position_title) = position_title
    )
  ),
  manager_employee_id TEXT CHECK (
    manager_employee_id IS NULL OR manager_employee_id != employee_id
  ),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  )
) WITHOUT ROWID;

INSERT INTO __new_company_organization_assignment_period_versions
SELECT * FROM company_organization_assignment_period_versions;

INSERT INTO _company_organization_foreign_key_validation
SELECT
  'company_organization_assignment_period_versions',
  (SELECT count(*) FROM company_organization_assignment_period_versions),
  (SELECT count(*) FROM __new_company_organization_assignment_period_versions),
  (SELECT count(*)
   FROM __new_company_organization_assignment_period_versions period
   LEFT JOIN company_organization_units unit
     ON unit.id = period.organization_unit_id
   LEFT JOIN company_organization_change_operations operation
     ON operation.id = period.recorded_by_action_id
   WHERE unit.id IS NULL OR operation.id IS NULL);

DROP TABLE company_organization_assignment_period_versions;
ALTER TABLE __new_company_organization_assignment_period_versions
  RENAME TO company_organization_assignment_period_versions;

CREATE INDEX company_organization_assignment_period_versions_employee_idx
  ON company_organization_assignment_period_versions(
    employee_id, starts_on, ends_on, assignment_type, period_id, revision
  );
CREATE INDEX company_organization_assignment_period_versions_unit_idx
  ON company_organization_assignment_period_versions(
    organization_unit_id, starts_on, ends_on, period_id, revision
  );

CREATE TABLE __new_company_organization_responsibility_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  employment_id TEXT NOT NULL CHECK (length(employment_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL CHECK (length(employee_id) BETWEEN 1 AND 128),
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  responsibility_type TEXT NOT NULL CHECK (
    length(responsibility_type) BETWEEN 1 AND 64
    AND responsibility_type GLOB '[A-Z]*'
    AND responsibility_type NOT GLOB '*[^A-Z0-9_]*'
  ),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  )
) WITHOUT ROWID;

INSERT INTO __new_company_organization_responsibility_period_versions
SELECT * FROM company_organization_responsibility_period_versions;

INSERT INTO _company_organization_foreign_key_validation
SELECT
  'company_organization_responsibility_period_versions',
  (SELECT count(*) FROM company_organization_responsibility_period_versions),
  (SELECT count(*) FROM __new_company_organization_responsibility_period_versions),
  (SELECT count(*)
   FROM __new_company_organization_responsibility_period_versions period
   LEFT JOIN company_organization_units unit
     ON unit.id = period.organization_unit_id
   LEFT JOIN company_organization_change_operations operation
     ON operation.id = period.recorded_by_action_id
   WHERE unit.id IS NULL OR operation.id IS NULL);

DROP TABLE company_organization_responsibility_period_versions;
ALTER TABLE __new_company_organization_responsibility_period_versions
  RENAME TO company_organization_responsibility_period_versions;

CREATE INDEX company_organization_responsibility_period_versions_employee_idx
  ON company_organization_responsibility_period_versions(
    employee_id, starts_on, ends_on, period_id, revision
  );
CREATE INDEX company_organization_responsibility_period_versions_unit_idx
  ON company_organization_responsibility_period_versions(
    organization_unit_id, responsibility_type, starts_on, ends_on, period_id, revision
  );

DROP TABLE _company_organization_foreign_key_validation;

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
