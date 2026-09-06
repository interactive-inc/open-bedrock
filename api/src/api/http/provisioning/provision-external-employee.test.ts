import { describe, expect, test } from "bun:test"
import { ProvisionExternalEmployee } from "@/api/http/provisioning/provision-external-employee"
import { ResolveLiveEmployeeAccessAdapter } from "@/contexts/company/infrastructure/adapters/employee/resolve-live-employee-access.adapter"
import { createTestContext } from "@tests/api/support/create-test-context"

const input = {
  subject: "external:example-person",
  email: "new@example.com",
  name: "Example Person",
  roleKey: "member",
  now: new Date("2026-01-01T00:00:00Z"),
}

describe("外部従業員の作成", () => {
  test("作成直後にCompanyの正本から在籍と対応Accountを解決できる", async () => {
    const fixture = await createTestContext()
    const employeeId = await new ProvisionExternalEmployee(fixture.context).run({
      ...input,
      provider: "oidc",
    })
    if (employeeId instanceof Error) throw employeeId
    expect(
      await new ResolveLiveEmployeeAccessAdapter(fixture.context).resolveLiveEmployeeAccess(
        employeeId,
      ),
    ).toMatchObject({ status: "ACTIVE" })
    expect(
      await fixture.db
        .prepare("SELECT account_id FROM company_account_employee_links WHERE employee_id = ?1")
        .bind(employeeId)
        .first(),
    ).not.toBeNull()
  })

  test("期間履歴の失敗時はSystem AccountとIdentityも作らない", async () => {
    const fixture = await createTestContext()
    const countBefore = await fixture.db
      .prepare("SELECT count(*) AS total FROM system_accounts")
      .first<number>("total")
    await fixture.db.exec(
      "CREATE TRIGGER reject_provision_status BEFORE INSERT ON company_employee_status_period_versions BEGIN SELECT RAISE(ABORT, 'status unavailable'); END;",
    )
    expect(
      await new ProvisionExternalEmployee(fixture.context).run({ ...input, provider: "oidc" }),
    ).toBeInstanceOf(Error)
    expect(
      await fixture.db
        .prepare("SELECT count(*) AS total FROM system_accounts")
        .first<number>("total"),
    ).toBe(countBefore)
    expect(
      await fixture.db
        .prepare("SELECT id FROM company_employees WHERE email = ?1")
        .bind(input.email)
        .first(),
    ).toBeNull()
    expect(
      await fixture.db
        .prepare("SELECT id FROM system_identity_bindings WHERE subject = ?1")
        .bind(input.subject)
        .first(),
    ).toBeNull()
  })
})
