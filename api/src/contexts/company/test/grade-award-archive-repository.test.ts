import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { GradeAwardArchiveEntity } from "@/contexts/company/domain/entities/grade-award-archive.entity"
import { GradeAwardSourceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/definitions/grade-award-source-snapshot.adapter"
import { GradeAwardArchiveRepository } from "@/contexts/company/infrastructure/repositories/definitions/grade-award-archive.repository"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

const portable = readFileSync(
  new URL("../infrastructure/schema/company.sql", import.meta.url),
  "utf8",
)
const archiveSql = portable.slice(
  portable.indexOf("CREATE TABLE company_grade_award_archives"),
  portable.indexOf(
    "\nEND;",
    portable.indexOf("CREATE TRIGGER company_grade_award_archive_no_delete"),
  ) + 5,
)
const auditContext = {
  authorizationJson: '{"permission":"company:write"}',
  metadataJson: '{"requestId":"request:archive"}',
}
async function fixture() {
  const database = createCompanyD1TestDatabase(`
    CREATE TABLE company_organizations(id TEXT PRIMARY KEY, revision INTEGER);
    INSERT INTO company_organizations VALUES ('organization:default', 8);
    CREATE TABLE company_employees(id TEXT PRIMARY KEY); INSERT INTO company_employees VALUES ('employee:one');
    CREATE TABLE system_accounts(id TEXT PRIMARY KEY); INSERT INTO system_accounts VALUES ('account:reviewer');
    CREATE TABLE company_grade_definitions(id INTEGER PRIMARY KEY, code TEXT, name TEXT, rank INTEGER, description TEXT, created_at TEXT);
    CREATE TABLE company_employee_grades(id INTEGER PRIMARY KEY, employee_id TEXT, grade_id INTEGER, effective_date TEXT, reason TEXT, created_at TEXT);
    INSERT INTO company_employee_grades VALUES (1, 'employee:one', 1, '2020-01-01', ' original ', 'unknown');
    CREATE TABLE system_audit_events(event_id TEXT PRIMARY KEY, actor_account_id TEXT, action TEXT, target_type TEXT, target_id TEXT, outcome TEXT, reason_code TEXT, authorization_json TEXT, before_json TEXT, after_json TEXT, metadata_json TEXT, occurred_at INTEGER);
    ${archiveSql}
    ${readFileSync(new URL("../infrastructure/schema/legacy-grade-award-guards.sql", import.meta.url), "utf8")}`)
  const snapshot = await new GradeAwardSourceSnapshotAdapter(database).find("employee:one")
  if (snapshot instanceof Error) throw snapshot
  const props = {
    commandId: "archive:one",
    employeeId: "employee:one",
    expectedRevision: 8,
    snapshotDigest: snapshot.props.digest,
    observedOn: "2030-01-01",
    actorAccountId: "account:reviewer",
    reason: "Preserve original records",
    recordedAt: Date.parse("2030-01-01T12:00:00Z"),
  }
  const command = GradeAwardArchiveEntity.create(props)
  if (command instanceof Error) throw command
  return {
    database,
    props,
    command,
    repository: new GradeAwardArchiveRepository({
      env: { DB: database, COMPANY_TIME_ZONE: "UTC" },
    }),
  }
}

test("監査と原記録を一緒に固定し、旧台帳撤去後の参照と翌日の再送でも同じ結果を返す", async () => {
  const f = await fixture()
  expect(await f.repository.archive(f.command, auditContext)).toMatchObject({
    replayed: false,
    observedCompanyRevision: 8,
  })
  await f.database.exec("DROP TABLE company_employee_grades; DROP TABLE company_grade_definitions;")
  const retry = GradeAwardArchiveEntity.create({
    ...f.props,
    recordedAt: f.props.recordedAt + 86400000,
  })
  if (retry instanceof Error) throw retry
  expect(await f.repository.archive(retry, auditContext)).toMatchObject({
    replayed: true,
    observedCompanyRevision: 8,
  })
  expect(await f.repository.findByEmployee(f.props.employeeId)).toEqual(
    await f.repository.find(f.props.commandId),
  )
  expect(await f.repository.findByEmployee("employee:missing")).toBeNull()
  expect(await f.repository.find(f.props.commandId)).toMatchObject({
    recordedAt: f.props.recordedAt,
    source: { awards: [{ reason: " original ", createdAt: "unknown", observedDefinition: null }] },
  })
  expect(
    await f.database
      .prepare("SELECT count(*) AS count FROM system_audit_events")
      .first<number>("count"),
  ).toBe(1)
  expect(
    await f.database
      .prepare("SELECT revision FROM company_organizations")
      .first<number>("revision"),
  ).toBe(8)
})

test.each([
  "CREATE TRIGGER fail_archive BEFORE INSERT ON company_grade_award_archives BEGIN SELECT RAISE(ABORT, 'failure'); END;",
  "CREATE TRIGGER ignore_archive BEFORE INSERT ON company_grade_award_archives BEGIN SELECT RAISE(IGNORE); END;",
  "CREATE TRIGGER ignore_audit BEFORE INSERT ON system_audit_events BEGIN SELECT RAISE(IGNORE); END;",
])("保存拒否・黙示的欠落は監査も原記録も残さず、復旧後に再試行できる: %s", async (trigger) => {
  const f = await fixture()
  await f.database.exec(trigger)
  expect(await f.repository.archive(f.command, auditContext)).toBeInstanceOf(Error)
  expect(await f.repository.find(f.props.commandId)).toBeNull()
  expect(
    await f.database
      .prepare("SELECT count(*) AS count FROM system_audit_events")
      .first<number>("count"),
  ).toBe(0)
  await f.database.exec(
    "DROP TRIGGER IF EXISTS fail_archive; DROP TRIGGER IF EXISTS ignore_archive; DROP TRIGGER IF EXISTS ignore_audit;",
  )
  expect(await f.repository.archive(f.command, auditContext)).toMatchObject({ replayed: false })
})

test("同じキーの内容変更と同じ従業員の別依頼は拒否し、古い会社版では保存しない", async () => {
  const f = await fixture()
  await f.database.prepare("UPDATE company_organizations SET revision = 9").run()
  expect(await f.repository.archive(f.command, auditContext)).toBeInstanceOf(Error)
  expect(await f.repository.find(f.props.commandId)).toBeNull()
  await f.database.prepare("UPDATE company_organizations SET revision = 8").run()
  expect(await f.repository.archive(f.command, auditContext)).toMatchObject({ replayed: false })
  for (const override of [{ reason: "Changed" }, { commandId: "archive:two" }]) {
    const changed = GradeAwardArchiveEntity.create({ ...f.props, ...override })
    if (changed instanceof Error) throw changed
    expect(await f.repository.archive(changed, auditContext)).toBeInstanceOf(Error)
  }
  expect(
    await f.database
      .prepare("SELECT count(*) AS count FROM system_audit_events")
      .first<number>("count"),
  ).toBe(1)
})

test("保存直前の元記録の変更を検知し、監査を含めて取消する", async () => {
  const f = await fixture()
  const database = new Proxy(f.database, {
    get(target, property, receiver) {
      if (property === "batch")
        return async (statements: D1PreparedStatement[]) => {
          await target
            .prepare("UPDATE company_employee_grades SET reason = 'Concurrent correction'")
            .run()
          return target.batch(statements)
        }
      return Reflect.get(target, property, receiver)
    },
  })
  const repository = new GradeAwardArchiveRepository({
    env: { DB: database, COMPANY_TIME_ZONE: "UTC" },
  })
  expect(await repository.archive(f.command, auditContext)).toBeInstanceOf(Error)
  expect(await f.repository.find(f.props.commandId)).toBeNull()
  expect(
    await f.database
      .prepare("SELECT count(*) AS count FROM system_audit_events")
      .first<number>("count"),
  ).toBe(0)
  expect(
    await f.database.prepare("SELECT reason FROM company_employee_grades").first<string>("reason"),
  ).toBe("Concurrent correction")
})

test("保存後の応答消失では成功済み記録から復旧し、同時再送も一度だけ保存する", async () => {
  const f = await fixture()
  const database = new Proxy(f.database, {
    get(target, property, receiver) {
      if (property === "batch")
        return async (statements: D1PreparedStatement[]) => {
          await target.batch(statements)
          throw new Error("response lost after commit")
        }
      return Reflect.get(target, property, receiver)
    },
  })
  const repository = new GradeAwardArchiveRepository({
    env: { DB: database, COMPANY_TIME_ZONE: "UTC" },
  })
  const receipts = await Promise.all([
    repository.archive(f.command, auditContext),
    repository.archive(f.command, auditContext),
  ])
  for (const receipt of receipts) expect(receipt).toMatchObject({ replayed: true })
  expect(
    await f.database
      .prepare("SELECT count(*) AS count FROM system_audit_events")
      .first<number>("count"),
  ).toBe(1)
  expect(
    await f.database
      .prepare("SELECT count(*) AS count FROM company_grade_award_archives")
      .first<number>("count"),
  ).toBe(1)
})

test("保全後の旧付与台帳への追加・変更・削除・別人への移動を拒否する", async () => {
  const f = await fixture()
  await f.database.prepare("INSERT INTO company_employees VALUES ('employee:two')").run()
  await f.database
    .prepare(
      "INSERT INTO company_employee_grades VALUES (2, 'employee:two', 1, '2021-01-01', NULL, 'unknown')",
    )
    .run()
  expect(await f.repository.archive(f.command, auditContext)).toMatchObject({ replayed: false })
  for (const sql of [
    "INSERT INTO company_employee_grades VALUES (3, 'employee:one', 1, '2022-01-01', NULL, 'unknown')",
    "UPDATE company_employee_grades SET reason = 'Changed' WHERE id = 1",
    "DELETE FROM company_employee_grades WHERE id = 1",
    "UPDATE company_employee_grades SET employee_id = 'employee:two' WHERE id = 1",
    "UPDATE company_employee_grades SET employee_id = 'employee:one' WHERE id = 2",
  ])
    expect(
      await f.database
        .prepare(sql)
        .run()
        .catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
  expect(
    await f.database
      .prepare("UPDATE company_employee_grades SET reason = 'Unarchived employee' WHERE id = 2")
      .run(),
  ).toMatchObject({ success: true })
  expect(await f.repository.find(f.props.commandId)).toMatchObject({
    source: { awards: [{ reason: " original " }] },
  })
})

test("大きい整数を保全保存し、元台帳の撤去後も同じ原文を再送・参照できる", async () => {
  const f = await fixture()
  await f.database
    .exec(`INSERT INTO company_grade_definitions VALUES (9223372036854775807, 'LARGE', 'Observed name', -9223372036854775808, NULL, 'unknown');
    UPDATE company_employee_grades SET id = 9223372036854775807, grade_id = 9223372036854775807;`)
  const snapshot = await new GradeAwardSourceSnapshotAdapter(f.database).find(f.props.employeeId)
  if (snapshot instanceof Error) throw snapshot
  const command = GradeAwardArchiveEntity.create({
    ...f.props,
    snapshotDigest: snapshot.props.digest,
  })
  if (command instanceof Error) throw command
  expect(await f.repository.archive(command, auditContext)).toMatchObject({ replayed: false })
  const before = await f.database
    .prepare("SELECT source_json FROM company_grade_award_archives")
    .first<string>("source_json")
  expect(before).toBe(snapshot.props.sourceJson)
  await f.database.exec("DROP TABLE company_employee_grades; DROP TABLE company_grade_definitions;")
  expect(await f.repository.archive(command, auditContext)).toMatchObject({ replayed: true })
  expect(await f.repository.findByEmployee(f.props.employeeId)).toMatchObject({
    snapshotDigest: snapshot.props.digest,
    source: {
      awards: [
        {
          id: "9223372036854775807",
          gradeId: "9223372036854775807",
          observedDefinition: { id: "9223372036854775807", rank: "-9223372036854775808" },
        },
      ],
    },
  })
  expect(
    await f.database
      .prepare("SELECT source_json FROM company_grade_award_archives")
      .first<string>("source_json"),
  ).toBe(before)
  expect(
    await f.database
      .prepare("SELECT count(*) AS count FROM system_audit_events")
      .first<number>("count"),
  ).toBe(1)
})
