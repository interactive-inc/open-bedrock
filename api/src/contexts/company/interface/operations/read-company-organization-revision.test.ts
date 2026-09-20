import { readCompanyOrganizationRevision } from "@/contexts/company/interface/operations/read-company-organization-revision"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"

function createDatabase(): D1Database {
  const sqlite = new Database(":memory:")
  sqlite.run("CREATE TABLE company_organizations (id TEXT PRIMARY KEY, revision INTEGER NOT NULL)")
  sqlite.run("INSERT INTO company_organizations VALUES ('organization:default', 7)")
  return createCompanyD1TestDatabase(sqlite)
}

test("会社の現在の版を返し、初期化前の会社は0を返す", async () => {
  const database = createDatabase()

  expect(
    await readCompanyOrganizationRevision({ database, organizationId: "organization:default" }),
  ).toBe(7)
  expect(
    await readCompanyOrganizationRevision({ database, organizationId: "organization:other" }),
  ).toBe(0)
})

test("保存先を参照できない場合は0で補わず失敗を返す", async () => {
  const database = createCompanyD1TestDatabase(new Database(":memory:"))

  expect(
    await readCompanyOrganizationRevision({ database, organizationId: "organization:default" }),
  ).toBeInstanceOf(Error)
})
