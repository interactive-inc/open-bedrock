import { prepareCompanyOrganizationRevisionStatement } from "@/contexts/company/interface/operations/prepare-company-organization-revision-statement"
import { readCompanyOrganizationLifecycleRevision } from "@/contexts/company/interface/operations/read-company-organization-lifecycle-revision"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"

function createDatabase(): D1Database {
  const sqlite = new Database(":memory:")
  sqlite.run("CREATE TABLE company_organizations (id TEXT PRIMARY KEY, revision INTEGER NOT NULL)")
  sqlite.run("INSERT INTO company_organizations VALUES ('organization:default', 7)")
  sqlite.run(
    "CREATE TABLE company_organization_lifecycle_states (id INTEGER PRIMARY KEY, revision INTEGER)",
  )
  sqlite.run("CREATE TABLE effects (id INTEGER PRIMARY KEY)")
  return createCompanyD1TestDatabase(sqlite)
}

function guard(database: D1Database, organizationId: string, expectedRevision: number) {
  const statement = prepareCompanyOrganizationRevisionStatement({
    database,
    organizationId,
    expectedRevision,
  })
  if (statement instanceof Error) throw statement
  return statement
}

test("会社版が一致すれば同じbatchの書込みを確定する", async () => {
  const database = createDatabase()

  await database.batch([
    guard(database, "organization:default", 7),
    database.prepare("INSERT INTO effects VALUES (1)"),
  ])

  expect(await database.prepare("SELECT count(*) AS n FROM effects").first<number>("n")).toBe(1)
})

test("会社版の不一致と組織の不在では、同じbatchの書込みを全体で戻す", async () => {
  const database = createDatabase()

  for (const [organizationId, revision] of [
    ["organization:default", 6],
    ["organization:other", 7],
  ] as const)
    await expect(
      database.batch([
        database.prepare("INSERT INTO effects VALUES (2)"),
        guard(database, organizationId, revision),
      ]),
    ).rejects.toThrow("malformed JSON")

  expect(await database.prepare("SELECT count(*) AS n FROM effects").first<number>("n")).toBe(0)
})

test("不正な組織IDと版を拒否する", () => {
  const database = createDatabase()

  expect(
    prepareCompanyOrganizationRevisionStatement({
      database,
      organizationId: "organization:default",
      expectedRevision: -1,
    }),
  ).toBeInstanceOf(Error)
  expect(
    prepareCompanyOrganizationRevisionStatement({
      database,
      organizationId: "",
      expectedRevision: 1,
    }),
  ).toBeInstanceOf(Error)
})

test("期間台帳の版を返し、未作成はnull、参照できない場合は失敗を返す", async () => {
  const database = createDatabase()

  expect(await readCompanyOrganizationLifecycleRevision({ database })).toBeNull()
  await database.prepare("INSERT INTO company_organization_lifecycle_states VALUES (1, 12)").run()
  expect(await readCompanyOrganizationLifecycleRevision({ database })).toBe(12)
  expect(
    await readCompanyOrganizationLifecycleRevision({
      database: createCompanyD1TestDatabase(new Database(":memory:")),
    }),
  ).toBeInstanceOf(Error)
})
