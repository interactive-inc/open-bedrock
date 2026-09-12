import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { GradeAwardArchiveEntity } from "@/contexts/company/domain/entities/grade-award-archive.entity"
import { GradeAwardSourceSnapshotValue } from "@/contexts/company/domain/values/grade-award-source-snapshot.value"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

const companySql = readFileSync(
  new URL("../infrastructure/schema/company.sql", import.meta.url),
  "utf8",
)
const archiveSql = companySql.slice(
  companySql.indexOf("CREATE TABLE company_grade_award_archives"),
  companySql.indexOf(
    "\nEND;",
    companySql.indexOf("CREATE TRIGGER company_grade_award_archive_no_delete"),
  ) + 5,
)

test("保全記録の所属・参照先と不変性をDBで強制し、元台帳がなくても原記録を保持する", async () => {
  const db = createCompanyD1TestDatabase(`PRAGMA foreign_keys=ON;
    CREATE TABLE company_organizations(id TEXT PRIMARY KEY); INSERT INTO company_organizations VALUES ('organization:default');
    CREATE TABLE company_employees(id TEXT PRIMARY KEY); INSERT INTO company_employees VALUES ('employee:one');
    CREATE TABLE system_accounts(id TEXT PRIMARY KEY); INSERT INTO system_accounts VALUES ('account:reviewer');
    ${archiveSql}`)
  const sourceJson = JSON.stringify({
    employeeId: "employee:one",
    organizationRevision: 8,
    awards: [],
  })
  const insert = () =>
    db
      .prepare(`INSERT INTO company_grade_award_archives VALUES
    ('organization:default', 'archive:one', 'employee:one', ?1, 'account:reviewer', 'Preserve original records',
    '2030-01-01', 8, ?1, ?2, 1)`)
      .bind("a".repeat(64), sourceJson)
  await insert().run()
  for (const sql of [
    "UPDATE company_grade_award_archives SET reason = 'Changed'",
    "DELETE FROM company_grade_award_archives",
    "DELETE FROM company_employees",
    "DELETE FROM system_accounts",
  ])
    expect(
      await db
        .prepare(sql)
        .run()
        .catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
  expect(
    await insert()
      .run()
      .catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  expect(
    await db
      .prepare("SELECT source_json FROM company_grade_award_archives")
      .first<string>("source_json"),
  ).toBe(sourceJson)
})

test("保全依頼は確認済みの人・会社版・digestと一致し、記録日時を過去の付与日時に読み替えない", async () => {
  const snapshot = await GradeAwardSourceSnapshotValue.create(
    JSON.stringify({ employeeId: "employee:one", organizationRevision: 8, awards: [] }),
  )
  if (snapshot instanceof Error) throw snapshot
  const props = {
    commandId: "archive:one",
    employeeId: "employee:one",
    expectedRevision: 8,
    snapshotDigest: snapshot.props.digest,
    observedOn: "2030-01-01",
    actorAccountId: "account:reviewer",
    reason: "Preserve original records",
    recordedAt: Date.parse("2030-01-01T00:00:00Z"),
  }
  const command = GradeAwardArchiveEntity.create(props)
  if (command instanceof Error) throw command
  expect(command.validateSource(snapshot)).toBeNull()
  expect(command.props.recordedAt).toBe(props.recordedAt)
  for (const override of [
    { employeeId: "employee:other" },
    { expectedRevision: 9 },
    { snapshotDigest: "b".repeat(64) },
  ]) {
    const changed = GradeAwardArchiveEntity.create({ ...props, ...override })
    if (changed instanceof Error) throw changed
    expect(changed.validateSource(snapshot)).toBeInstanceOf(Error)
  }
  expect(GradeAwardArchiveEntity.create({ ...props, reason: " " })).toBeInstanceOf(Error)
})
