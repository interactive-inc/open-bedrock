import { UpdateCompanyAccountProfile } from "@/contexts/company/application/account-profile/update-company-account-profile"
import { D1CompanyAccountProfileRepository } from "@/contexts/company/infrastructure/repositories/account-profile/d1-company-account-profile.repository"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { describe, expect, test } from "bun:test"
import { CompanyAccountNameManagedByEmployeeError } from "@/contexts/company/domain/errors"

const schemaSql = `
  CREATE TABLE system_accounts (
    id TEXT PRIMARY KEY NOT NULL,
    status TEXT NOT NULL,
    token_version INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE company_organizations (
    id TEXT PRIMARY KEY NOT NULL,
    revision INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE company_account_profiles (
    organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (organization_id, account_id)
  );
  CREATE TABLE company_account_employee_links (
    account_id TEXT PRIMARY KEY NOT NULL,
    employee_id TEXT NOT NULL UNIQUE
  );
  INSERT INTO company_organizations (id, revision, created_at, updated_at)
    VALUES ('organization:default', 0, 0, 0);
`

describe("Company Account Profile", () => {
  test("読み取り後の従業員紐付けを保存時に再検査する", async () => {
    const database = createCompanyD1TestDatabase(`${schemaSql}
      INSERT INTO system_accounts VALUES ('account-1', 'active', 7, 100, 100);
      INSERT INTO company_account_profiles VALUES ('organization:default', 'account-1', 'Employee name', 100, 100);
    `)
    const repository = new D1CompanyAccountProfileRepository(database)
    const commit = database.batch.bind(database)
    database.batch = async (statements) => {
      await database
        .prepare("INSERT INTO company_account_employee_links VALUES ('account-1', 'employee-1')")
        .run()
      return commit(statements)
    }
    const result = await new UpdateCompanyAccountProfile(repository).execute(
      "organization:default",
      "account-1",
      "Stale rename",
      new Date(200),
    )
    expect(result).toBeInstanceOf(CompanyAccountNameManagedByEmployeeError)
    expect(
      await database
        .prepare("SELECT display_name, updated_at FROM company_account_profiles")
        .first<{ display_name: string; updated_at: number }>(),
    ).toEqual({ display_name: "Employee name", updated_at: 100 })
  })

  test("紐付いたAccountでも同じ表示名は履歴時刻を変えずに返す", async () => {
    const database = createCompanyD1TestDatabase(`${schemaSql}
      INSERT INTO system_accounts VALUES ('account-1', 'active', 7, 100, 100);
      INSERT INTO company_account_profiles VALUES ('organization:default', 'account-1', 'Employee name', 100, 100);
      INSERT INTO company_account_employee_links VALUES ('account-1', 'employee-1');
    `)
    const result = await new UpdateCompanyAccountProfile(
      new D1CompanyAccountProfileRepository(database),
    ).execute("organization:default", "account-1", "Employee name", new Date(200))
    expect(result).not.toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT display_name, updated_at FROM company_account_profiles")
        .first<{ display_name: string; updated_at: number }>(),
    ).toEqual({ display_name: "Employee name", updated_at: 100 })
  })

  test("reads and updates the Company-owned display name without changing System Account", async () => {
    const database = createCompanyD1TestDatabase(`${schemaSql}
      INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
        VALUES ('account-1', 'active', 7, 100, 100);
      INSERT INTO company_account_profiles
        (organization_id, account_id, display_name, created_at, updated_at)
        VALUES ('organization:default', 'account-1', 'Before', 100, 100);
    `)
    const repository = new D1CompanyAccountProfileRepository(database)

    const before = await repository.find({
      organizationId: "organization:default",
      accountId: "account-1",
    })
    expect(before).not.toBeNull()
    expect(before).not.toBeInstanceOf(Error)
    if (before === null || before instanceof Error) return
    expect(before.displayName).toBe("Before")

    const updated = await new UpdateCompanyAccountProfile(repository).execute(
      "organization:default",
      "account-1",
      "After",
      new Date(200),
    )
    expect(updated).not.toBeNull()
    expect(updated).not.toBeInstanceOf(Error)
    if (updated === null || updated instanceof Error) return
    expect(updated.displayName).toBe("After")
    expect(
      await database
        .prepare("SELECT status, token_version FROM system_accounts WHERE id = 'account-1'")
        .first<{ status: string; token_version: number }>(),
    ).toEqual({ status: "active", token_version: 7 })
  })

  test("does not create a missing profile during update", async () => {
    const database = createCompanyD1TestDatabase(schemaSql)
    const repository = new D1CompanyAccountProfileRepository(database)

    expect(
      await new UpdateCompanyAccountProfile(repository).execute(
        "organization:default",
        "missing",
        "Name",
        new Date(200),
      ),
    ).toBeNull()
  })
})
