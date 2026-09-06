import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { EmployeeRepository } from "@/contexts/company/infrastructure/repositories/employee/employee.repository"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"

async function fixture() {
  const database = createD1TestDatabase(loadSchema())
  await database.exec(`
    INSERT OR IGNORE INTO company_organizations (id, revision, created_at, updated_at)
      VALUES ('organization:default', 0, 0, 0);
    INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES
      ('account:linked', 'active', 0, 0, 0),
      ('account:unlinked', 'active', 0, 0, 0);
    INSERT INTO company_employees (id, official_name, employee_code, created_at, updated_at)
      VALUES ('employee:1', 'Example Person', 'E001', 0, 0);
    INSERT INTO company_account_employee_links (account_id, employee_id)
      VALUES ('account:linked', 'employee:1');
    INSERT INTO company_account_profiles (organization_id, account_id, display_name, created_at, updated_at) VALUES
      ('organization:default', 'account:linked', 'Example Person', 0, 0),
      ('organization:default', 'account:unlinked', 'Unlinked Person', 0, 0);
  `)
  const repository = new EmployeeRepository({
    env: { DB: database },
    var: {
      database: drizzle(database),
      auditContext: {
        requestId: "request:1",
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      },
    },
  })
  const employee = await repository.find({ code: "E001" })
  if (employee === null || employee instanceof Error)
    throw employee ?? new Error("Missing employee")
  return { database, repository, employee }
}

describe("Company employeeとAccountの表示名", () => {
  test("氏名と紐付きAccount表示名を同時に更新し、紐付かないAccountを変えない", async () => {
    const { database, repository, employee } = await fixture()
    const changed = employee.withOfficialName("Changed Person")
    if (changed instanceof Error) throw changed
    expect(await repository.update(changed, new Date(100))).toMatchObject({
      officialName: "Changed Person",
    })
    expect(
      (
        await database
          .prepare(
            "SELECT account_id, display_name FROM company_account_profiles ORDER BY account_id",
          )
          .all()
      ).results,
    ).toEqual([
      { account_id: "account:linked", display_name: "Changed Person" },
      { account_id: "account:unlinked", display_name: "Unlinked Person" },
    ])
  })

  test("表示名の保存失敗では従業員氏名も更新しない", async () => {
    const { database, repository, employee } = await fixture()
    await database.exec(
      "CREATE TRIGGER reject_profile_update BEFORE UPDATE ON company_account_profiles BEGIN SELECT RAISE(ABORT, 'profile_write_failed'); END;",
    )
    const changed = employee.withOfficialName("Changed Person")
    if (changed instanceof Error) throw changed
    expect(await repository.update(changed, new Date(100))).toBeInstanceOf(Error)
    expect(await repository.find({ code: "E001" })).toMatchObject({
      officialName: "Example Person",
    })
  })

  test("両方のDDLが許す200文字の氏名を切り詰めずに保存する", async () => {
    const { database, repository, employee } = await fixture()
    const officialName = "名".repeat(200)
    const changed = employee.withOfficialName(officialName)
    if (changed instanceof Error) throw changed
    expect(await repository.update(changed, new Date(100))).toMatchObject({ officialName })
    expect(
      await database
        .prepare(
          "SELECT display_name FROM company_account_profiles WHERE account_id = 'account:linked'",
        )
        .first<{ display_name: string }>(),
    ).toEqual({ display_name: officialName })
  })
})
