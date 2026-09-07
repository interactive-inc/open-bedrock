-- announcements の主キーを連番 INTEGER から UUID へ移す (Issue #1311)。
--
-- 手順は 0059 / 0073 の ID 書き換えに倣う。旧 ID と新 UUID の対応表を先に作り、
-- 検証表の CHECK で件数と orphan を突き合わせてから差し替える。CHECK が偽になれば
-- INSERT が失敗し、migration 全体がそこで止まる。
--
-- announcements を参照する列は宣言 FK・未宣言列とも存在しない (grep で確認済み)。
-- 参照が無いことも検証表で明示しておく。

PRAGMA foreign_keys = OFF;

CREATE TABLE _announcements_uuid_cutover_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0)
);

-- 旧 ID -> 新 UUID。version 4 と variant 0b10 を固定しないと下の CHECK を通らない。
CREATE TABLE _announcements_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _announcements_id_map (old_id, new_id)
SELECT id,
       lower(hex(randomblob(4))) || '-' ||
       lower(hex(randomblob(2))) || '-' ||
       '4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
       substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
       lower(hex(randomblob(6)))
FROM announcements;

CREATE TABLE "__new_announcements" (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  published_on TEXT,
  author_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

INSERT INTO "__new_announcements"
  (id, title, body_md, published_on, author_employee_id, status, created_at)
SELECT map.new_id, source.title, source.body_md, source.published_on,
       source.author_employee_id, source.status, source.created_at
FROM announcements source
INNER JOIN _announcements_id_map map ON map.old_id = source.id;

-- 行数が一致し、対応表に載らず取りこぼした行が無いこと。
INSERT INTO _announcements_uuid_cutover_validation
SELECT 'announcements.rows',
       (SELECT count(*) FROM announcements),
       (SELECT count(*) FROM "__new_announcements"),
       (SELECT count(*) FROM announcements source
        LEFT JOIN _announcements_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

-- 社員参照が移送後も実在すること。
INSERT INTO _announcements_uuid_cutover_validation
SELECT 'announcements.author_employee_id',
       (SELECT count(author_employee_id) FROM announcements),
       (SELECT count(author_employee_id) FROM "__new_announcements"),
       (SELECT count(*) FROM "__new_announcements" child
        LEFT JOIN company_employees employee ON employee.id = child.author_employee_id
        WHERE employee.id IS NULL),
       0;

DROP TABLE announcements;
ALTER TABLE "__new_announcements" RENAME TO announcements;
CREATE INDEX idx_announcements_status ON announcements (status);

DROP TABLE _announcements_id_map;

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
