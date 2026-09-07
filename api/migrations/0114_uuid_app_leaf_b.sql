-- 段1 の単独 table をまとめて UUID へ移す (Issue #1311)。
--
-- 対象: employee_work_styles, headcount_plans, health_checkups, it_incidents, knowledge_articles
--
-- いずれも他 table から参照されず、参照列も持たない。table recreate で消える index は
-- 元の DDL から復元する。

PRAGMA foreign_keys = OFF;

CREATE TABLE _app_leaf_b_uuid_cutover_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0)
);

CREATE TABLE _employee_work_styles_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _employee_work_styles_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM employee_work_styles;

CREATE TABLE _headcount_plans_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _headcount_plans_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM headcount_plans;

CREATE TABLE _health_checkups_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _health_checkups_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM health_checkups;

CREATE TABLE _it_incidents_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _it_incidents_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM it_incidents;

CREATE TABLE _knowledge_articles_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _knowledge_articles_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM knowledge_articles;

CREATE TABLE "__new_employee_work_styles" (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  style TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_employee_work_styles" (id, employee_id, style, starts_on, ends_on, note, created_at)
SELECT map.new_id, source.employee_id, source.style, source.starts_on, source.ends_on, source.note, source.created_at
FROM employee_work_styles source
INNER JOIN _employee_work_styles_id_map map ON map.old_id = source.id;

INSERT INTO _app_leaf_b_uuid_cutover_validation
SELECT 'employee_work_styles.rows',
       (SELECT count(*) FROM employee_work_styles),
       (SELECT count(*) FROM "__new_employee_work_styles"),
       (SELECT count(*) FROM employee_work_styles source
        LEFT JOIN _employee_work_styles_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

CREATE TABLE "__new_headcount_plans" (
  id TEXT PRIMARY KEY NOT NULL,
  fiscal_year INTEGER NOT NULL,
  department_code TEXT,
  planned_count INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_headcount_plans" (id, fiscal_year, department_code, planned_count, note, created_at)
SELECT map.new_id, source.fiscal_year, source.department_code, source.planned_count, source.note, source.created_at
FROM headcount_plans source
INNER JOIN _headcount_plans_id_map map ON map.old_id = source.id;

INSERT INTO _app_leaf_b_uuid_cutover_validation
SELECT 'headcount_plans.rows',
       (SELECT count(*) FROM headcount_plans),
       (SELECT count(*) FROM "__new_headcount_plans"),
       (SELECT count(*) FROM headcount_plans source
        LEFT JOIN _headcount_plans_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

CREATE TABLE "__new_health_checkups" (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  checkup_kind TEXT NOT NULL,
  conducted_on TEXT,
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_health_checkups" (id, employee_id, fiscal_year, checkup_kind, conducted_on, status, note, created_at)
SELECT map.new_id, source.employee_id, source.fiscal_year, source.checkup_kind, source.conducted_on, source.status, source.note, source.created_at
FROM health_checkups source
INNER JOIN _health_checkups_id_map map ON map.old_id = source.id;

INSERT INTO _app_leaf_b_uuid_cutover_validation
SELECT 'health_checkups.rows',
       (SELECT count(*) FROM health_checkups),
       (SELECT count(*) FROM "__new_health_checkups"),
       (SELECT count(*) FROM health_checkups source
        LEFT JOIN _health_checkups_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

CREATE TABLE "__new_it_incidents" (
  id TEXT PRIMARY KEY NOT NULL,
  occurred_at TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  severity TEXT,
  status TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_it_incidents" (id, occurred_at, title, summary, severity, status, resolved_at, created_at)
SELECT map.new_id, source.occurred_at, source.title, source.summary, source.severity, source.status, source.resolved_at, source.created_at
FROM it_incidents source
INNER JOIN _it_incidents_id_map map ON map.old_id = source.id;

INSERT INTO _app_leaf_b_uuid_cutover_validation
SELECT 'it_incidents.rows',
       (SELECT count(*) FROM it_incidents),
       (SELECT count(*) FROM "__new_it_incidents"),
       (SELECT count(*) FROM it_incidents source
        LEFT JOIN _it_incidents_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

CREATE TABLE "__new_knowledge_articles" (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT,
  body_md TEXT NOT NULL,
  author_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_knowledge_articles" (id, title, category, tags, body_md, author_id, created_at)
SELECT map.new_id, source.title, source.category, source.tags, source.body_md, source.author_id, source.created_at
FROM knowledge_articles source
INNER JOIN _knowledge_articles_id_map map ON map.old_id = source.id;

INSERT INTO _app_leaf_b_uuid_cutover_validation
SELECT 'knowledge_articles.rows',
       (SELECT count(*) FROM knowledge_articles),
       (SELECT count(*) FROM "__new_knowledge_articles"),
       (SELECT count(*) FROM knowledge_articles source
        LEFT JOIN _knowledge_articles_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

DROP TABLE knowledge_articles;
DROP TABLE it_incidents;
DROP TABLE health_checkups;
DROP TABLE headcount_plans;
DROP TABLE employee_work_styles;
ALTER TABLE "__new_employee_work_styles" RENAME TO employee_work_styles;
ALTER TABLE "__new_headcount_plans" RENAME TO headcount_plans;
ALTER TABLE "__new_health_checkups" RENAME TO health_checkups;
ALTER TABLE "__new_it_incidents" RENAME TO it_incidents;
ALTER TABLE "__new_knowledge_articles" RENAME TO knowledge_articles;

CREATE INDEX idx_employee_work_styles_employee ON employee_work_styles (employee_id);
CREATE UNIQUE INDEX uq_headcount_plans_year_department ON headcount_plans (fiscal_year, department_code);
CREATE INDEX idx_health_checkups_employee ON health_checkups (employee_id);
CREATE INDEX idx_health_checkups_fiscal_year ON health_checkups (fiscal_year);
CREATE INDEX idx_it_incidents_occurred_at ON it_incidents (occurred_at);
CREATE INDEX idx_knowledge_articles_category ON knowledge_articles (category);

DROP TABLE _employee_work_styles_id_map;
DROP TABLE _headcount_plans_id_map;
DROP TABLE _health_checkups_id_map;
DROP TABLE _it_incidents_id_map;
DROP TABLE _knowledge_articles_id_map;

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
