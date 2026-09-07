-- career_postings と career_applications の主キーを UUID へ移す (Issue #1311)。
--
-- career_applications.posting_id は career_postings.id を指すが `REFERENCES` が無い。
-- 宣言 FK が無い参照は `PRAGMA foreign_key_check` では検出できないため、対応表で
-- 付け替えたうえで orphan を検証表で明示的に数える。

PRAGMA foreign_keys = OFF;

CREATE TABLE _career_uuid_cutover_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0)
);

CREATE TABLE _career_postings_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _career_postings_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM career_postings;

CREATE TABLE _career_applications_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _career_applications_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM career_applications;

-- 親: career_postings。dept_id は参照先を持たない既存の不具合なので INTEGER のまま
-- 残す (Issue #1329)。UUID 化の取りこぼしではない。
CREATE TABLE "__new_career_postings" (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  dept_id INTEGER,
  dept_name TEXT,
  required_skills TEXT,
  status TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_career_postings" (id, title, dept_id, dept_name, required_skills, status)
SELECT map.new_id, source.title, source.dept_id, source.dept_name,
       source.required_skills, source.status
FROM career_postings source
INNER JOIN _career_postings_id_map map ON map.old_id = source.id;

INSERT INTO _career_uuid_cutover_validation
SELECT 'career_postings.rows',
       (SELECT count(*) FROM career_postings),
       (SELECT count(*) FROM "__new_career_postings"),
       (SELECT count(*) FROM career_postings source
        LEFT JOIN _career_postings_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

-- 子: career_applications。posting_id を対応表で付け替える。
CREATE TABLE "__new_career_applications" (
  id TEXT PRIMARY KEY NOT NULL,
  posting_id TEXT NOT NULL,
  applicant_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  message TEXT,
  status TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]'),
  CHECK (length(posting_id) = 36 AND posting_id NOT GLOB '*[^0-9a-f-]*' AND substr(posting_id, 9, 1) = '-' AND substr(posting_id, 14, 1) = '-' AND substr(posting_id, 19, 1) = '-' AND substr(posting_id, 24, 1) = '-' AND length(replace(posting_id, '-', '')) = 32 AND substr(posting_id, 15, 1) GLOB '[1-8]' AND substr(posting_id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_career_applications" (id, posting_id, applicant_id, message, status)
SELECT application_map.new_id, posting_map.new_id, source.applicant_id,
       source.message, source.status
FROM career_applications source
INNER JOIN _career_applications_id_map application_map ON application_map.old_id = source.id
INNER JOIN _career_postings_id_map posting_map ON posting_map.old_id = source.posting_id;

INSERT INTO _career_uuid_cutover_validation
SELECT 'career_applications.rows',
       (SELECT count(*) FROM career_applications),
       (SELECT count(*) FROM "__new_career_applications"),
       (SELECT count(*) FROM career_applications source
        LEFT JOIN _career_applications_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

-- 未宣言参照の追従を検証する。付け替え漏れがあればここで止まる。
INSERT INTO _career_uuid_cutover_validation
SELECT 'career_applications.posting_id',
       (SELECT count(posting_id) FROM career_applications),
       (SELECT count(posting_id) FROM "__new_career_applications"),
       (SELECT count(*) FROM "__new_career_applications" child
        LEFT JOIN "__new_career_postings" parent ON parent.id = child.posting_id
        WHERE parent.id IS NULL),
       0;

INSERT INTO _career_uuid_cutover_validation
SELECT 'career_applications.applicant_id',
       (SELECT count(applicant_id) FROM career_applications),
       (SELECT count(applicant_id) FROM "__new_career_applications"),
       (SELECT count(*) FROM "__new_career_applications" child
        LEFT JOIN company_employees employee ON employee.id = child.applicant_id
        WHERE employee.id IS NULL),
       0;

DROP TABLE career_applications;
DROP TABLE career_postings;
ALTER TABLE "__new_career_postings" RENAME TO career_postings;
ALTER TABLE "__new_career_applications" RENAME TO career_applications;

CREATE INDEX idx_career_postings_status ON career_postings (status);
CREATE INDEX idx_career_applications_applicant ON career_applications (applicant_id);
CREATE INDEX idx_career_applications_posting ON career_applications (posting_id);
CREATE UNIQUE INDEX idx_career_applications_posting_applicant
  ON career_applications (posting_id, applicant_id);

DROP TABLE _career_postings_id_map;
DROP TABLE _career_applications_id_map;

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
