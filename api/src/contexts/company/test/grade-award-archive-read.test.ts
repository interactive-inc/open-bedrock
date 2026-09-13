import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { GradeAwardSourceSnapshotValue } from "@/contexts/company/domain/values/grade-award-source-snapshot.value"
import { GradeAwardArchiveReadAdapter } from "@/contexts/company/infrastructure/adapters/definitions/grade-award-archive-read.adapter"
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

/** 旧台帳を作らず、移行前に保全された原文を配置する。 */
async function fixture(corruptDigest = false) {
  const database = createCompanyD1TestDatabase(`
    CREATE TABLE company_organizations(id TEXT PRIMARY KEY, revision INTEGER);
    INSERT INTO company_organizations VALUES ('organization:default', 8);
    CREATE TABLE company_employees(id TEXT PRIMARY KEY); INSERT INTO company_employees VALUES ('employee:one');
    CREATE TABLE system_accounts(id TEXT PRIMARY KEY); INSERT INTO system_accounts VALUES ('account:reviewer');
    ${archiveSql}`)
  const snapshot = await GradeAwardSourceSnapshotValue.create(
    JSON.stringify({
      organizationRevision: 8,
      employeeId: "employee:one",
      awards: [
        {
          id: "9007199254740993",
          employeeId: "employee:one",
          gradeId: 1,
          effectiveDate: "2020-01-01",
          reason: " original ",
          createdAt: "unknown",
          observedDefinition: null,
        },
      ],
    }),
  )
  if (snapshot instanceof Error) throw snapshot
  await database
    .prepare(`INSERT INTO company_grade_award_archives
    (organization_id, command_id, employee_id, fingerprint, actor_account_id, reason, observed_on,
      observed_company_revision, snapshot_digest, source_json, recorded_at)
    VALUES ('organization:default', 'archive:one', 'employee:one', ?1, 'account:reviewer',
      'Preserve original records', '2030-01-01', 8, ?2, ?3, 100)`)
    .bind(
      "a".repeat(64),
      corruptDigest ? "0".repeat(64) : snapshot.props.digest,
      snapshot.props.sourceJson,
    )
    .run()
  return { database, adapter: new GradeAwardArchiveReadAdapter({ env: { DB: database } }) }
}

test("旧台帳なしで原文・主体・確認日時を依頼IDと従業員IDから取得する", async () => {
  const f = await fixture()
  const record = await f.adapter.find("archive:one")
  expect(record).toMatchObject({
    actorAccountId: "account:reviewer",
    recordedAt: 100,
    observedOn: "2030-01-01",
    source: {
      awards: [
        {
          id: "9007199254740993",
          reason: " original ",
          createdAt: "unknown",
          observedDefinition: null,
        },
      ],
    },
  })
  expect(await f.adapter.findByEmployee("employee:one")).toEqual(record)
  expect(await f.adapter.find("missing")).toBeNull()
  expect(await f.adapter.findByEmployee("missing")).toBeNull()
})

test("原文のdigestが一致しない記録を返さない", async () => {
  const f = await fixture(true)
  expect(await f.adapter.find("archive:one")).toBeInstanceOf(Error)
  expect(await f.adapter.findByEmployee("employee:one")).toBeInstanceOf(Error)
})
