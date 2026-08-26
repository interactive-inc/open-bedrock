import { UpdateCompanyAccountProfile } from "@/contexts/company/application/account-profile/update-company-account-profile"
import { D1CompanyAccountProfileRepository } from "@/contexts/company/infrastructure/repositories/account-profile/d1-company-account-profile.repository"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { describe, expect, test } from "bun:test"

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
  INSERT INTO company_organizations (id, revision, created_at, updated_at)
    VALUES ('organization:default', 0, 0, 0);
`

describe("Company Account Profile", () => {
  test("reads and updates the Company-owned display name without changing System Account", async () => {
    const database = createCompanyD1TestDatabase(`${schemaSql}
      INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
        VALUES ('account-1', 'active', 7, 100, 100);
      INSERT INTO company_account_profiles
        (organization_id, account_id, display_name, created_at, updated_at)
        VALUES ('organization:default', 'account-1', 'Before', 100, 100);
    `)
    const repository = new D1CompanyAccountProfileRepository(database)

    const before = await repository.find("organization:default", "account-1")
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
