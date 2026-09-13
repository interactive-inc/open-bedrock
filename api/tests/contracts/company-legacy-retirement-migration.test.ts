import { Database } from "bun:sqlite"
import { executeSql } from "../../scripts/sql-statements"
import { expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const retirementMigration = readFileSync(
  join(import.meta.dir, "../../migrations/0214_retire_company_legacy_definitions.sql"),
  "utf8",
)

/** 原文破損も作れる最小の読取fixture。保存時の制約の検証とは分離する。 */
function fixture() {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE company_grade_definitions (id INTEGER, code TEXT, name TEXT, rank INTEGER, description TEXT, created_at TEXT);
    CREATE TABLE company_position_definitions (id INTEGER, code TEXT, name TEXT, rank INTEGER, description TEXT, created_at TEXT);
    CREATE TABLE company_employee_grades (id INTEGER, employee_id TEXT, grade_id INTEGER, effective_date TEXT, reason TEXT, created_at TEXT);
    CREATE TABLE company_definition_resource_adoptions (organization_id TEXT, resource_type TEXT, definition_id INTEGER, source_json TEXT);
    CREATE TABLE company_grade_award_archives (organization_id TEXT, employee_id TEXT, observed_company_revision INTEGER, source_json TEXT);
    INSERT INTO company_grade_definitions VALUES (1, 'G1', 'Grade', 1, NULL, 'original-time');
    INSERT INTO company_position_definitions VALUES (1, 'P1', 'Position', 2, 'original description', 'original-time');
    INSERT INTO company_employee_grades VALUES (9007199254740993, 'employee-1', 1, '2020-01-01', NULL, 'raw-time');
    INSERT INTO company_definition_resource_adoptions
    SELECT 'organization:default', 'grade', id, json_object('definition', json_object('type', 'grade',
      'id', id, 'code', code, 'name', name, 'rank', rank, 'description', description, 'createdAt', created_at))
    FROM company_grade_definitions;
    INSERT INTO company_definition_resource_adoptions
    SELECT 'organization:default', 'position', id, json_object('definition', json_object('type', 'position',
      'id', id, 'code', code, 'name', name, 'rank', rank, 'description', description, 'createdAt', created_at))
    FROM company_position_definitions;
    INSERT INTO company_grade_award_archives
    SELECT 'organization:default', employee_id, 3, json_object('employeeId', employee_id, 'organizationRevision', 3,
      'awards', json_array(json_object('id', CAST(id AS TEXT), 'employeeId', employee_id, 'gradeId', grade_id,
      'effectiveDate', effective_date, 'reason', reason, 'createdAt', created_at))) FROM company_employee_grades;
  `)
  database.exec(`
    ALTER TABLE company_definition_resource_adoptions ADD COLUMN command_id TEXT;
    ALTER TABLE company_definition_resource_adoptions ADD COLUMN resource_id TEXT;
    ALTER TABLE company_definition_resource_adoptions ADD COLUMN organization_revision INTEGER;
    ALTER TABLE company_definition_resource_adoptions ADD COLUMN expected_revision INTEGER;
    ALTER TABLE company_definition_resource_adoptions ADD COLUMN actor_account_id TEXT;
    ALTER TABLE company_definition_resource_adoptions ADD COLUMN reason TEXT;
    ALTER TABLE company_definition_resource_adoptions ADD COLUMN recorded_at INTEGER;
    ALTER TABLE company_definition_resource_adoptions ADD COLUMN observed_on TEXT;
    UPDATE company_definition_resource_adoptions SET command_id = resource_type || '-command',
      resource_id = resource_type || '-resource', organization_revision = 2, expected_revision = 1,
      actor_account_id = 'actor-1', reason = 'observed definition', recorded_at = 100, observed_on = '2026-01-01';
    CREATE TABLE company_resource_revisions AS SELECT organization_id, resource_type, resource_id,
      1 AS revision, 'active' AS state, command_id, organization_revision, actor_account_id, reason,
      recorded_at, observed_on AS effective_from, NULL AS effective_to,
      json_object('code', json_extract(source_json, '$.definition.code'),
        'officialName', json_extract(source_json, '$.definition.name'),
        'rank', json_extract(source_json, '$.definition.rank'),
        'description', json_extract(source_json, '$.definition.description')) AS attributes_json
      FROM company_definition_resource_adoptions;
    CREATE TABLE company_command_receipts AS SELECT organization_id, command_id,
      expected_revision, organization_revision, recorded_at FROM company_definition_resource_adoptions;
  `)
  return database
}

test("撤去前までの全migrationを適用したschemaで検査できる", () => {
  using database = new Database(":memory:")
  const directory = join(import.meta.dir, "../../migrations")
  for (const filename of readdirSync(directory)
    .filter(
      (name) => name.endsWith(".sql") && name !== "0214_retire_company_legacy_definitions.sql",
    )
    .sort()) {
    executeSql(database, readFileSync(join(directory, filename), "utf8"), filename)
  }
  executeSql(database, retirementMigration, "legacy retirement")
  expect(
    database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('company_grade_definitions', 'company_position_definitions', 'company_employee_grades')",
      )
      .all(),
  ).toEqual([])
})

test("大きな整数ID・null・原日時を損なわない保全を照合し、保全原文を残す", () => {
  using database = fixture()
  executeSql(database, retirementMigration, "legacy retirement")
  expect(
    database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('company_grade_definitions', 'company_position_definitions', 'company_employee_grades')",
      )
      .all(),
  ).toEqual([])
  expect(
    database.query("SELECT COUNT(*) AS count FROM company_grade_award_archives").get(),
  ).toEqual({
    count: 1,
  })
})

test.each([
  ["grade", "DELETE FROM company_resource_revisions WHERE resource_type = 'grade'"],
  [
    "position",
    "UPDATE company_resource_revisions SET actor_account_id = 'wrong-actor' WHERE resource_type = 'position'",
  ],
  [
    "grade",
    "UPDATE company_command_receipts SET organization_revision = 9 WHERE command_id = 'grade-command'",
  ],
  [
    "grade",
    "UPDATE company_resource_revisions SET attributes_json = json_set(attributes_json, '$.rank', 99) WHERE resource_type = 'grade'",
  ],
  ["grade", "DELETE FROM company_definition_resource_adoptions WHERE resource_type = 'grade'"],
  [
    "position",
    "UPDATE company_definition_resource_adoptions SET source_json = json_set(source_json, '$.definition.name', 'changed') WHERE resource_type = 'position'",
  ],
  [
    "grade",
    "UPDATE company_definition_resource_adoptions SET source_json = json_remove(source_json, '$.definition.description') WHERE resource_type = 'grade'",
  ],
  [
    "grade-award",
    "UPDATE company_grade_award_archives SET source_json = json_remove(source_json, '$.awards[0].reason')",
  ],
  [
    "grade-award",
    "UPDATE company_grade_award_archives SET source_json = json_set(source_json, '$.awards[0].createdAt', 'changed')",
  ],
  ["grade-award", "UPDATE company_grade_award_archives SET employee_id = 'employee-2'"],
  ["grade-award", "UPDATE company_grade_award_archives SET observed_company_revision = 4"],
  [
    "grade-award",
    "UPDATE company_grade_award_archives SET source_json = json_set(source_json, '$.awards[0].id', '9007199254740992')",
  ],
  [
    "grade-award",
    "UPDATE company_grade_award_archives SET source_json = json_set(source_json, '$.awards', json('[]'))",
  ],
])("%sの欠落・変更があれば撤去しない (%s)", (_sourceType, mutation) => {
  using database = fixture()
  database.exec(mutation)
  expect(() => executeSql(database, retirementMigration, "legacy retirement")).toThrow()
  for (const table of [
    "company_grade_definitions",
    "company_position_definitions",
    "company_employee_grades",
  ]) {
    expect(database.query(`SELECT count(*) AS count FROM ${table}`).get()).toEqual({ count: 1 })
  }
})

test("移行後の正当な訂正・取消があっても移行時の改訂で照合する", () => {
  using database = fixture()
  database.exec(`INSERT INTO company_resource_revisions
    SELECT organization_id, resource_type, resource_id, 2, 'void', 'later-command', 10,
      actor_account_id, 'later correction', 200, effective_from, effective_to,
      json_set(attributes_json, '$.officialName', 'later name') FROM company_resource_revisions`)
  executeSql(database, retirementMigration, "legacy retirement")
  expect(
    database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('company_grade_definitions', 'company_position_definitions', 'company_employee_grades')",
      )
      .all(),
  ).toEqual([])
})

test("保全済みの旧台帳だけを撤去し、保全原文と公開履歴を変更しない", () => {
  using database = fixture()
  const original = database.query("SELECT source_json FROM company_grade_award_archives").all()
  const revisions = database.query("SELECT * FROM company_resource_revisions").all()
  executeSql(database, retirementMigration, "legacy retirement")
  expect(
    database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('company_grade_definitions', 'company_position_definitions', 'company_employee_grades')",
      )
      .all(),
  ).toEqual([])
  expect(database.query("SELECT source_json FROM company_grade_award_archives").all()).toEqual(
    original,
  )
  expect(database.query("SELECT * FROM company_resource_revisions").all()).toEqual(revisions)
})

test("保全不足では最初のDROP前に停止し、旧台帳を全て保持する", () => {
  using database = fixture()
  database.exec(
    "DELETE FROM company_definition_resource_adoptions WHERE resource_type = 'position'",
  )
  expect(() => executeSql(database, retirementMigration, "legacy retirement")).toThrow()
  for (const table of [
    "company_grade_definitions",
    "company_position_definitions",
    "company_employee_grades",
  ]) {
    expect(database.query(`SELECT count(*) AS count FROM ${table}`).get()).toEqual({ count: 1 })
  }
})
