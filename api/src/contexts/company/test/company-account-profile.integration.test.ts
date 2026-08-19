import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { UpdateCompanyAccountProfile } from "@/contexts/company/application/account-profile/update-company-account-profile"
import { CompanyAccountProfileRepositoryD1 } from "@/contexts/company/infrastructure/account-profile/company-account-profile.repository"
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const migrationsDirectory = join(import.meta.dir, "../../../../migrations")

function allMigrations(): string {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(migrationsDirectory, file), "utf8"))
    .join("\n")
}

describe("Company Account Profile", () => {
  test("reads and updates the Company-owned display name without changing System Account", async () => {
    const database = createD1TestDatabase(allMigrations())
    await database.exec(`
      INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
        VALUES ('account-1', 'active', 7, 100, 100);
      INSERT INTO company_account_profiles
        (organization_id, account_id, display_name, created_at, updated_at)
        VALUES ('organization:default', 'account-1', 'Before', 100, 100);
    `)
    const repository = new CompanyAccountProfileRepositoryD1(database)

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
    const database = createD1TestDatabase(allMigrations())
    const repository = new CompanyAccountProfileRepositoryD1(database)

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
