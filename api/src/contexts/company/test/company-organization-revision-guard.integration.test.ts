import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { companyOrganizations } from "@/contexts/company/infrastructure/schema/company"
import { prepareCompanyOrganizationRevisionGuard } from "@/contexts/company/interface/operations/prepare-company-organization-revision-guard"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"

test("Company 版の競合と組織不在で他 context の batch 書込を戻す", async () => {
  const database = createCompanyD1TestDatabase(
    readFileSync(
      new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
      "utf8",
    ) +
      "\n" +
      readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8"),
  )
  await database
    .prepare(`INSERT INTO company_organizations
      (id, revision, name, representative_name, created_at, updated_at)
      VALUES ('organization:default', 1, 'Before', '', 1, 1)`)
    .run()
  const orm = drizzle(database)
  const write = orm
    .update(companyOrganizations)
    .set({ name: "After" })
    .where(eq(companyOrganizations.id, "organization:default"))
  const guard = (expectedRevision: number, organizationId = "organization:default") => {
    const statement = prepareCompanyOrganizationRevisionGuard({
      database,
      organizationId,
      expectedRevision,
    })
    if (statement instanceof Error) throw statement
    return statement
  }
  const name = () =>
    database
      .prepare("SELECT name FROM company_organizations WHERE id = 'organization:default'")
      .first<string>("name")

  await expect(orm.batch([guard(0), write])).rejects.toThrow()
  expect(await name()).toBe("Before")

  await expect(orm.batch([guard(1, "organization:missing"), write])).rejects.toThrow()
  expect(await name()).toBe("Before")

  await orm.batch([guard(1), write])
  expect(await name()).toBe("After")
})
