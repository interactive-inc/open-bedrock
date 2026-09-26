import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { sql } from "drizzle-orm"
import { CompanyAccountEmployeeLinkPredicateAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-account-employee-link-predicate.adapter"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

describe("Company Account対応のSQL条件", () => {
  test("旧対応を使わず、公開履歴の取消と同日訂正を反映する", async () => {
    const database = createCompanyD1TestDatabase(`
      CREATE TABLE company_account_employee_resource_bindings (
        resource_id TEXT, organization_id TEXT, account_id TEXT, employee_id TEXT
      );
      CREATE TABLE company_resource_revisions (
        organization_id TEXT, resource_type TEXT, resource_id TEXT, revision INTEGER,
        state TEXT, effective_from TEXT, effective_to TEXT, attributes_json TEXT
      );
      CREATE TABLE company_account_employee_links (account_id TEXT, employee_id TEXT);
      INSERT INTO company_account_employee_links VALUES ('account:legacy', 'employee:legacy');
      INSERT INTO company_account_employee_resource_bindings VALUES
        ('link:1', '${COMPANY_DEFAULT_ORGANIZATION_ID}', 'account:1', 'employee:1');
      INSERT INTO company_resource_revisions VALUES
        ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'account-employee-link', 'link:1', 1, 'active',
         '2026-01-01', NULL, '{"accountId":"account:1","employeeId":"employee:1"}'),
        ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'account-employee-link', 'link:1', 2, 'void',
         '2026-09-01', NULL, '{"accountId":"account:1","employeeId":"employee:1"}');
    `)
    const matches = async (date: string, accountId: string, employeeId = "employee:1") => {
      const predicate = new CompanyAccountEmployeeLinkPredicateAdapter({
        asOf: restoreCalendarDate(date),
      })
      const rows = await drizzle(database)
        .select({
          matched: predicate.matches({
            accountId: sql`${accountId}`,
            employeeId: sql`${employeeId}`,
          }),
        })
        .from(sql`(SELECT 1)`)
      return rows[0]?.matched
    }
    expect(await matches("2026-08-31", "account:1")).toBe(1)
    expect(await matches("2026-09-01", "account:1")).toBe(0)
    expect(await matches("2026-08-31", "account:legacy", "employee:legacy")).toBe(0)
    await database.exec(`INSERT INTO company_resource_revisions VALUES
      ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'account-employee-link', 'link:1', 3, 'active',
       '2026-09-01', NULL, '{"accountId":"account:1","employeeId":"employee:1"}');`)
    expect(await matches("2026-09-01", "account:1")).toBe(1)
  })
})
