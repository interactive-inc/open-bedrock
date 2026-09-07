-- 段1 の単独 table をまとめて UUID へ移す (Issue #1311)。
--
-- 対象: leave_requests, company_calendar_days, work_accidents
--
-- いずれも他 table から参照されず、参照列も持たない。table recreate で消える index は
-- 元の DDL から復元する。

PRAGMA foreign_keys = OFF;

CREATE TABLE _app_leaf_c_uuid_cutover_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0)
);

CREATE TABLE _leave_requests_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _leave_requests_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM leave_requests;

CREATE TABLE _company_calendar_days_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _company_calendar_days_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM company_calendar_days;

CREATE TABLE _work_accidents_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _work_accidents_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM work_accidents;

CREATE TABLE "__new_leave_requests" (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL,
  approver_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  decided_comment TEXT,
  created_at TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'full_day',
  hours REAL,
  consumed_days REAL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_leave_requests" (id, employee_id, leave_type, start_date, end_date, days, reason, status, approver_id, decided_comment, created_at, unit, hours, consumed_days)
SELECT map.new_id, source.employee_id, source.leave_type, source.start_date, source.end_date, source.days, source.reason, source.status, source.approver_id, source.decided_comment, source.created_at, source.unit, source.hours, source.consumed_days
FROM leave_requests source
INNER JOIN _leave_requests_id_map map ON map.old_id = source.id;

INSERT INTO _app_leaf_c_uuid_cutover_validation
SELECT 'leave_requests.rows',
       (SELECT count(*) FROM leave_requests),
       (SELECT count(*) FROM "__new_leave_requests"),
       (SELECT count(*) FROM leave_requests source
        LEFT JOIN _leave_requests_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

CREATE TABLE "__new_company_calendar_days" (
  id TEXT PRIMARY KEY NOT NULL,
  calendar_date TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_company_calendar_days" (id, calendar_date, kind, name, created_at)
SELECT map.new_id, source.calendar_date, source.kind, source.name, source.created_at
FROM company_calendar_days source
INNER JOIN _company_calendar_days_id_map map ON map.old_id = source.id;

INSERT INTO _app_leaf_c_uuid_cutover_validation
SELECT 'company_calendar_days.rows',
       (SELECT count(*) FROM company_calendar_days),
       (SELECT count(*) FROM "__new_company_calendar_days"),
       (SELECT count(*) FROM company_calendar_days source
        LEFT JOIN _company_calendar_days_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

CREATE TABLE "__new_work_accidents" (
  id TEXT PRIMARY KEY NOT NULL,
  occurred_on TEXT NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  location TEXT,
  summary TEXT NOT NULL,
  severity TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_work_accidents" (id, occurred_on, employee_id, location, summary, severity, status, created_at)
SELECT map.new_id, source.occurred_on, source.employee_id, source.location, source.summary, source.severity, source.status, source.created_at
FROM work_accidents source
INNER JOIN _work_accidents_id_map map ON map.old_id = source.id;

INSERT INTO _app_leaf_c_uuid_cutover_validation
SELECT 'work_accidents.rows',
       (SELECT count(*) FROM work_accidents),
       (SELECT count(*) FROM "__new_work_accidents"),
       (SELECT count(*) FROM work_accidents source
        LEFT JOIN _work_accidents_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

DROP TABLE work_accidents;
DROP TABLE company_calendar_days;
DROP TABLE leave_requests;
ALTER TABLE "__new_leave_requests" RENAME TO leave_requests;
ALTER TABLE "__new_company_calendar_days" RENAME TO company_calendar_days;
ALTER TABLE "__new_work_accidents" RENAME TO work_accidents;

CREATE INDEX idx_leave_requests_employee ON leave_requests (employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests (status);
CREATE UNIQUE INDEX uq_company_calendar_days_date ON company_calendar_days (calendar_date);
CREATE INDEX idx_work_accidents_employee ON work_accidents (employee_id);
CREATE INDEX idx_work_accidents_occurred_on ON work_accidents (occurred_on);

DROP TABLE _leave_requests_id_map;
DROP TABLE _company_calendar_days_id_map;
DROP TABLE _work_accidents_id_map;

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
