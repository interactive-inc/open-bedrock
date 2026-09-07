-- certification_definitions と employee_certifications の主キーを UUID へ移す (Issue #1311)。
--
-- employee_certifications.certification_id は certification_definitions.id を指すが
-- `REFERENCES` が無い。宣言 FK が無い参照は `PRAGMA foreign_key_check` で検出できないため、
-- 対応表で付け替えたうえで orphan を検証表に明示的に数える。

PRAGMA foreign_keys = OFF;

CREATE TABLE _certification_uuid_cutover_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0)
);

CREATE TABLE _certification_definitions_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _certification_definitions_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM certification_definitions;

CREATE TABLE _employee_certifications_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _employee_certifications_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM employee_certifications;

CREATE TABLE "__new_certification_definitions" (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  issuer TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_certification_definitions" (id, code, name, issuer, description, created_at)
SELECT map.new_id, source.code, source.name, source.issuer, source.description, source.created_at
FROM certification_definitions source
INNER JOIN _certification_definitions_id_map map ON map.old_id = source.id;

INSERT INTO _certification_uuid_cutover_validation
SELECT 'certification_definitions.rows',
       (SELECT count(*) FROM certification_definitions),
       (SELECT count(*) FROM "__new_certification_definitions"),
       (SELECT count(*) FROM certification_definitions source
        LEFT JOIN _certification_definitions_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

CREATE TABLE "__new_employee_certifications" (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  certification_id TEXT NOT NULL,
  acquired_on TEXT NOT NULL,
  expires_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]'),
  CHECK (length(certification_id) = 36 AND certification_id NOT GLOB '*[^0-9a-f-]*' AND substr(certification_id, 9, 1) = '-' AND substr(certification_id, 14, 1) = '-' AND substr(certification_id, 19, 1) = '-' AND substr(certification_id, 24, 1) = '-' AND length(replace(certification_id, '-', '')) = 32 AND substr(certification_id, 15, 1) GLOB '[1-8]' AND substr(certification_id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_employee_certifications" (id, employee_id, certification_id, acquired_on, expires_on, note, created_at)
SELECT map.new_id, source.employee_id, certification_id_map.new_id, source.acquired_on, source.expires_on, source.note, source.created_at
FROM employee_certifications source
INNER JOIN _employee_certifications_id_map map ON map.old_id = source.id
INNER JOIN _certification_definitions_id_map certification_id_map ON certification_id_map.old_id = source.certification_id;

INSERT INTO _certification_uuid_cutover_validation
SELECT 'employee_certifications.rows',
       (SELECT count(*) FROM employee_certifications),
       (SELECT count(*) FROM "__new_employee_certifications"),
       (SELECT count(*) FROM employee_certifications source
        LEFT JOIN _employee_certifications_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

INSERT INTO _certification_uuid_cutover_validation
SELECT 'employee_certifications.certification_id',
       (SELECT count(certification_id) FROM employee_certifications),
       (SELECT count(certification_id) FROM "__new_employee_certifications"),
       (SELECT count(*) FROM "__new_employee_certifications" child
        LEFT JOIN "__new_certification_definitions" parent ON parent.id = child.certification_id
        WHERE parent.id IS NULL),
       0;

DROP TABLE employee_certifications;
DROP TABLE certification_definitions;
ALTER TABLE "__new_certification_definitions" RENAME TO certification_definitions;
ALTER TABLE "__new_employee_certifications" RENAME TO employee_certifications;

CREATE INDEX idx_certifications_code ON "certification_definitions" (code);
CREATE INDEX idx_employee_certifications_certification ON employee_certifications (certification_id);
CREATE INDEX idx_employee_certifications_employee ON employee_certifications (employee_id);
CREATE UNIQUE INDEX idx_employee_certifications_unique ON employee_certifications (employee_id, certification_id, acquired_on);

DROP TABLE _certification_definitions_id_map;
DROP TABLE _employee_certifications_id_map;

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
