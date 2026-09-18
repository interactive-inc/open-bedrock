-- 段1 の単独 table をまとめて UUID へ移す (Issue #1311)。
--
-- 対象: asset_lendings, attendance_records, commendations, disciplinary_actions, document_ledger_entries
--
-- いずれも他 table から参照されず、参照列も持たない。table recreate で消える index は
-- 元の DDL から復元する。

PRAGMA foreign_keys = OFF;

CREATE TABLE _app_leaf_a_uuid_cutover_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0)
);

CREATE TABLE _asset_lendings_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _asset_lendings_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM asset_lendings;

CREATE TABLE _attendance_records_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _attendance_records_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM attendance_records;

CREATE TABLE _commendations_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _commendations_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM commendations;

CREATE TABLE _disciplinary_actions_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _disciplinary_actions_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM disciplinary_actions;

CREATE TABLE _document_ledger_entries_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _document_ledger_entries_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM document_ledger_entries;

CREATE TABLE "__new_asset_lendings" (
  id TEXT PRIMARY KEY NOT NULL,
  asset_code TEXT NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  lent_at TEXT NOT NULL,
  returned_at TEXT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_asset_lendings" (id, asset_code, employee_id, lent_at, returned_at)
SELECT map.new_id, source.asset_code, source.employee_id, source.lent_at, source.returned_at
FROM asset_lendings source
INNER JOIN _asset_lendings_id_map map ON map.old_id = source.id;

INSERT INTO _app_leaf_a_uuid_cutover_validation
SELECT 'asset_lendings.rows',
       (SELECT count(*) FROM asset_lendings),
       (SELECT count(*) FROM "__new_asset_lendings"),
       (SELECT count(*) FROM asset_lendings source
        LEFT JOIN _asset_lendings_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

CREATE TABLE "__new_attendance_records" (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  work_date TEXT NOT NULL,
  clock_in_at TEXT,
  clock_out_at TEXT,
  work_minutes INTEGER,
  note TEXT,
  status TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_attendance_records" (id, employee_id, work_date, clock_in_at, clock_out_at, work_minutes, note, status)
SELECT map.new_id, source.employee_id, source.work_date, source.clock_in_at, source.clock_out_at, source.work_minutes, source.note, source.status
FROM attendance_records source
INNER JOIN _attendance_records_id_map map ON map.old_id = source.id;

INSERT INTO _app_leaf_a_uuid_cutover_validation
SELECT 'attendance_records.rows',
       (SELECT count(*) FROM attendance_records),
       (SELECT count(*) FROM "__new_attendance_records"),
       (SELECT count(*) FROM attendance_records source
        LEFT JOIN _attendance_records_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

CREATE TABLE "__new_commendations" (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  awarded_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_commendations" (id, employee_id, title, reason, awarded_on, created_at)
SELECT map.new_id, source.employee_id, source.title, source.reason, source.awarded_on, source.created_at
FROM commendations source
INNER JOIN _commendations_id_map map ON map.old_id = source.id;

INSERT INTO _app_leaf_a_uuid_cutover_validation
SELECT 'commendations.rows',
       (SELECT count(*) FROM commendations),
       (SELECT count(*) FROM "__new_commendations"),
       (SELECT count(*) FROM commendations source
        LEFT JOIN _commendations_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

CREATE TABLE "__new_disciplinary_actions" (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  decided_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_disciplinary_actions" (id, employee_id, kind, summary, decided_on, created_at)
SELECT map.new_id, source.employee_id, source.kind, source.summary, source.decided_on, source.created_at
FROM disciplinary_actions source
INNER JOIN _disciplinary_actions_id_map map ON map.old_id = source.id;

INSERT INTO _app_leaf_a_uuid_cutover_validation
SELECT 'disciplinary_actions.rows',
       (SELECT count(*) FROM disciplinary_actions),
       (SELECT count(*) FROM "__new_disciplinary_actions"),
       (SELECT count(*) FROM disciplinary_actions source
        LEFT JOIN _disciplinary_actions_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

CREATE TABLE "__new_document_ledger_entries" (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  location TEXT NOT NULL,
  partner_code TEXT,
  expires_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_document_ledger_entries" (id, title, category, location, partner_code, expires_on, note, created_at)
SELECT map.new_id, source.title, source.category, source.location, source.partner_code, source.expires_on, source.note, source.created_at
FROM document_ledger_entries source
INNER JOIN _document_ledger_entries_id_map map ON map.old_id = source.id;

INSERT INTO _app_leaf_a_uuid_cutover_validation
SELECT 'document_ledger_entries.rows',
       (SELECT count(*) FROM document_ledger_entries),
       (SELECT count(*) FROM "__new_document_ledger_entries"),
       (SELECT count(*) FROM document_ledger_entries source
        LEFT JOIN _document_ledger_entries_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

DROP TABLE document_ledger_entries;
DROP TABLE disciplinary_actions;
DROP TABLE commendations;
DROP TABLE attendance_records;
DROP TABLE asset_lendings;
ALTER TABLE "__new_asset_lendings" RENAME TO asset_lendings;
ALTER TABLE "__new_attendance_records" RENAME TO attendance_records;
ALTER TABLE "__new_commendations" RENAME TO commendations;
ALTER TABLE "__new_disciplinary_actions" RENAME TO disciplinary_actions;
ALTER TABLE "__new_document_ledger_entries" RENAME TO document_ledger_entries;

CREATE INDEX idx_asset_lendings_asset ON asset_lendings (asset_code);
CREATE INDEX idx_asset_lendings_employee ON asset_lendings (employee_id);
CREATE INDEX idx_attendance_records_employee ON attendance_records (employee_id);
CREATE INDEX idx_attendance_records_employee_open ON attendance_records (employee_id, status);
CREATE UNIQUE INDEX idx_attendance_records_employee_open_unique ON attendance_records (employee_id) WHERE status = 'open';
CREATE INDEX idx_attendance_records_work_date ON attendance_records (work_date);
CREATE INDEX idx_commendations_employee ON commendations (employee_id);
CREATE INDEX idx_disciplinary_actions_employee ON disciplinary_actions (employee_id);
CREATE INDEX idx_documents_expires_on ON "document_ledger_entries" (expires_on);

DROP TABLE _asset_lendings_id_map;
DROP TABLE _attendance_records_id_map;
DROP TABLE _commendations_id_map;
DROP TABLE _disciplinary_actions_id_map;
DROP TABLE _document_ledger_entries_id_map;

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
