import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { CompanyAccountProfileRenameGuardAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/company-account-profile-rename-guard.adapter"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

describe("Companyの表示名所有者ガード", () => {
  test("同一transactionの先行変更を取り消し、紐付けを保全する", async () => {
    const database = createCompanyD1TestDatabase(`
      CREATE TABLE company_account_employee_links (account_id TEXT PRIMARY KEY, employee_id TEXT);
      INSERT INTO company_account_employee_links VALUES ('account-1', 'employee-1');
      CREATE TABLE writes (value TEXT);
    `)
    const query = new CompanyAccountProfileRenameGuardAdapter(drizzle(database))
      .build("account-1")
      .toSQL()
    const failure = await database
      .batch([
        database.prepare("INSERT INTO writes VALUES ('earlier effect')"),
        database.prepare(query.sql).bind(...query.params),
      ])
      .then(
        () => null,
        (cause: unknown) => cause,
      )
    expect(CompanyAccountProfileRenameGuardAdapter.isBlocked(failure)).toBe(true)
    expect((await database.prepare("SELECT * FROM writes").all()).results).toEqual([])
    expect(
      (await database.prepare("SELECT * FROM company_account_employee_links").all()).results,
    ).toEqual([{ account_id: "account-1", employee_id: "employee-1" }])
    expect(
      await new CompanyAccountProfileRenameGuardAdapter(drizzle(database))
        .build("unlinked-account")
        .get(),
    ).toEqual({ ok: 1 })
  })

  test("Companyの拒否を、接続障害・一般的なJSONエラー・別のガードと混同しない", () => {
    expect(
      CompanyAccountProfileRenameGuardAdapter.isBlocked(
        new Error(
          "D1_ERROR: bad JSON path: 'company_account_name_managed_by_employee': SQLITE_ERROR",
        ),
      ),
    ).toBe(true)
    expect(
      CompanyAccountProfileRenameGuardAdapter.isBlocked(
        new Error("query failed", {
          cause: new Error("JSON path error near 'company_account_name_managed_by_employee'"),
        }),
      ),
    ).toBe(true)
    expect(CompanyAccountProfileRenameGuardAdapter.isBlocked(new Error("malformed JSON"))).toBe(
      false,
    )
    expect(
      CompanyAccountProfileRenameGuardAdapter.isBlocked(
        new Error("Failed query: company_account_name_managed_by_employee", {
          cause: new Error("no such table: company_account_employee_links"),
        }),
      ),
    ).toBe(false)
    const cyclic = new Error("connection failed")
    cyclic.cause = cyclic
    expect(CompanyAccountProfileRenameGuardAdapter.isBlocked(cyclic)).toBe(false)
  })
})
