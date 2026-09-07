-- decision_records の主キーを UUID へ移す (Issue #1311)。
--
-- superseded_by_id は同じ table の id を指す自己参照で、NULL 可。対応表との join を
-- INNER にすると NULL の行が丸ごと落ちるので LEFT JOIN で写し、NULL は NULL のまま残す。
-- CHECK も「NULL または UUID」にする。

PRAGMA foreign_keys = OFF;

CREATE TABLE _decision_uuid_cutover_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0)
);

CREATE TABLE _decision_records_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _decision_records_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || '4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM decision_records;

CREATE TABLE "__new_decision_records" (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  decided_on TEXT NOT NULL,
  context TEXT NOT NULL,
  decision TEXT NOT NULL,
  consequences TEXT,
  status TEXT NOT NULL,
  superseded_by_id TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]'),
  CHECK (superseded_by_id IS NULL OR (length(superseded_by_id) = 36 AND superseded_by_id NOT GLOB '*[^0-9a-f-]*' AND substr(superseded_by_id, 9, 1) = '-' AND substr(superseded_by_id, 14, 1) = '-' AND substr(superseded_by_id, 19, 1) = '-' AND substr(superseded_by_id, 24, 1) = '-' AND length(replace(superseded_by_id, '-', '')) = 32 AND substr(superseded_by_id, 15, 1) GLOB '[1-8]' AND substr(superseded_by_id, 20, 1) GLOB '[89ab]'))
);
INSERT INTO "__new_decision_records" (id, title, decided_on, context, decision, consequences, status, superseded_by_id, created_at)
SELECT map.new_id, source.title, source.decided_on, source.context, source.decision, source.consequences, source.status, superseded_by_id_map.new_id, source.created_at
FROM decision_records source
INNER JOIN _decision_records_id_map map ON map.old_id = source.id
LEFT JOIN _decision_records_id_map superseded_by_id_map ON superseded_by_id_map.old_id = source.superseded_by_id;

INSERT INTO _decision_uuid_cutover_validation
SELECT 'decision_records.rows',
       (SELECT count(*) FROM decision_records),
       (SELECT count(*) FROM "__new_decision_records"),
       (SELECT count(*) FROM decision_records source
        LEFT JOIN _decision_records_id_map map ON map.old_id = source.id
        WHERE map.old_id IS NULL),
       0;

INSERT INTO _decision_uuid_cutover_validation
SELECT 'decision_records.superseded_by_id',
       (SELECT count(superseded_by_id) FROM decision_records),
       (SELECT count(superseded_by_id) FROM "__new_decision_records"),
       (SELECT count(*) FROM "__new_decision_records" child
        LEFT JOIN "__new_decision_records" parent ON parent.id = child.superseded_by_id
        WHERE child.superseded_by_id IS NOT NULL AND parent.id IS NULL),
       0;

DROP TABLE decision_records;
ALTER TABLE "__new_decision_records" RENAME TO decision_records;

CREATE INDEX idx_decisions_status ON "decision_records" (status);

DROP TABLE _decision_records_id_map;

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
