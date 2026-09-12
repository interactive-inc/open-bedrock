import { expect, test } from "bun:test"
import { GradeAwardSourceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/definitions/grade-award-source-snapshot.adapter"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

function fixture() {
  const database = createCompanyD1TestDatabase(`
    CREATE TABLE company_organizations(id TEXT PRIMARY KEY, revision INTEGER);
    INSERT INTO company_organizations VALUES ('organization:default', 8);
    CREATE TABLE company_employees(id TEXT PRIMARY KEY);
    INSERT INTO company_employees VALUES ('employee:one'), ('employee:two'), ('employee:empty'), ('employee:many');
    CREATE TABLE company_grade_definitions(id INTEGER PRIMARY KEY, code TEXT, name TEXT, rank INTEGER, description TEXT, created_at TEXT);
    INSERT INTO company_grade_definitions VALUES (1, 'G1', 'Observed current name', 1, NULL, '2020-01-01T00:00:00Z');
    CREATE TABLE company_employee_grades(id INTEGER PRIMARY KEY, employee_id TEXT, grade_id INTEGER, effective_date TEXT, reason TEXT, created_at TEXT);
    INSERT INTO company_employee_grades VALUES (2, 'employee:one', 2, '2021-01-01', NULL, 'unknown');
    INSERT INTO company_employee_grades VALUES (1, 'employee:one', 1, '2020-01-01', '  original reason  ', '2020-02-01T00:00:00Z');
    INSERT INTO company_employee_grades VALUES (3, 'employee:two', 1, '2020-01-01', NULL, '2020-01-01T00:00:00Z');
    CREATE TABLE archive_effect(id INTEGER PRIMARY KEY);
  `)
  return { database, adapter: new GradeAwardSourceSnapshotAdapter(database) }
}

test("付与履歴の原文と欠落した定義を保全し、雇用・終了日・過去名称を補わない", async () => {
  const f = fixture()
  const snapshot = await f.adapter.find("employee:one")
  if (snapshot instanceof Error) throw snapshot
  expect(snapshot.props.value.organizationRevision).toBe(8)
  expect(snapshot.props.value.awards).toHaveLength(2)
  expect(snapshot.props.value.awards[0]).toEqual({
    id: 1,
    employeeId: "employee:one",
    gradeId: 1,
    effectiveDate: "2020-01-01",
    reason: "  original reason  ",
    createdAt: "2020-02-01T00:00:00Z",
    observedDefinition: {
      id: 1,
      code: "G1",
      name: "Observed current name",
      rank: 1,
      description: null,
      createdAt: "2020-01-01T00:00:00Z",
    },
  })
  expect(snapshot.props.value.awards[1]).toEqual({
    id: 2,
    employeeId: "employee:one",
    gradeId: 2,
    effectiveDate: "2021-01-01",
    reason: null,
    createdAt: "unknown",
    observedDefinition: null,
  })
  await f.database.batch([
    f.adapter.prepareGuard(snapshot),
    f.database.prepare("INSERT INTO archive_effect VALUES (1)"),
  ])
  expect(
    await f.database.prepare("SELECT count(*) AS count FROM archive_effect").first<number>("count"),
  ).toBe(1)
})

test.each([
  "UPDATE company_employee_grades SET reason = 'Changed' WHERE id = 1",
  "UPDATE company_employee_grades SET effective_date = '2020-03-01' WHERE id = 1",
  "UPDATE company_employee_grades SET employee_id = 'employee:two' WHERE id = 1",
  "DELETE FROM company_employee_grades WHERE id = 2",
  "INSERT INTO company_employee_grades VALUES (4, 'employee:one', 1, '2022-01-01', NULL, 'unknown')",
  "UPDATE company_grade_definitions SET name = 'Renamed' WHERE id = 1",
  "INSERT INTO company_grade_definitions VALUES (2, 'G2', 'Recovered definition', 2, NULL, 'unknown')",
  "UPDATE company_organizations SET revision = 9",
  "DELETE FROM company_employees WHERE id = 'employee:one'",
])("確認後の元記録・定義・会社版の変更で保全処理を全体取消する: %s", async (mutation) => {
  const f = fixture()
  const snapshot = await f.adapter.find("employee:one")
  if (snapshot instanceof Error) throw snapshot
  await f.database.prepare(mutation).run()
  const failure = await f.database
    .batch([
      f.database.prepare("INSERT INTO archive_effect VALUES (1)"),
      f.adapter.prepareGuard(snapshot),
    ])
    .catch((cause: unknown) => cause)
  expect(failure).toBeInstanceOf(Error)
  expect(
    await f.database.prepare("SELECT count(*) AS count FROM archive_effect").first<number>("count"),
  ).toBe(0)
})

test("制限を超える履歴を黙って切り詰めず、空集合への追加も検出する", async () => {
  const f = fixture()
  const empty = await f.adapter.find("employee:empty")
  if (empty instanceof Error) throw empty
  expect(empty.props.value.awards).toHaveLength(0)
  await f.database
    .prepare(
      "INSERT INTO company_employee_grades VALUES (4, 'employee:empty', 1, '2020-01-01', NULL, 'unknown')",
    )
    .run()
  expect(
    await f.database.batch([f.adapter.prepareGuard(empty)]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  await f.database
    .exec(`WITH RECURSIVE numbers(id) AS (SELECT 100 UNION ALL SELECT id + 1 FROM numbers WHERE id < 1100)
    INSERT INTO company_employee_grades SELECT id, 'employee:many', 1, '2020-01-01', NULL, 'unknown' FROM numbers;`)
  expect(await f.adapter.find("employee:many")).toBeInstanceOf(Error)
})

test("存在しない従業員を履歴ゼロの従業員として保全しない", async () => {
  const f = fixture()
  expect(await f.adapter.find("employee:missing")).toBeInstanceOf(Error)
  const empty = await f.adapter.find("employee:empty")
  if (empty instanceof Error) throw empty
  expect(empty.props.value.awards).toHaveLength(0)
})
