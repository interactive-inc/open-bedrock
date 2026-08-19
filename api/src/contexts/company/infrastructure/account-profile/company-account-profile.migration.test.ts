import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const migrationsDirectory = join(import.meta.dir, "../../../../../migrations")

function schemaThrough(fileName: string): string {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql") && file <= fileName)
    .sort()
    .map((file) => readFileSync(join(migrationsDirectory, file), "utf8"))
    .join("\n")
}

describe("0144 Company Account Profile", () => {
  test("all System Accounts receive one valid Company-owned display profile", async () => {
    const database = createD1TestDatabase(schemaThrough("0143_opaque_company_account_ids.sql"))

    await database.exec(`
      INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES
        ('account-linked', 'active', 0, 100, 200),
        ('account-email', 'active', 0, 300, 400),
        ('account-id-only', 'active', 0, 500, 600);
      INSERT INTO employees (id, code, name, status)
        VALUES (1, 'E001', 'Linked Employee', 'active');
      INSERT INTO account_employee_links (account_id, employee_id)
        VALUES ('account-linked', 1);
      INSERT INTO system_identity_bindings
        (id, account_id, provider, subject, created_at, activated_at, revoked_at)
        VALUES ('identity-email', 'account-email', 'password', 'person@example.com', 300, 300, NULL);
      INSERT INTO system_identity_profiles
        (identity_id, email, email_verified, last_used_at, updated_at)
        VALUES ('identity-email', 'person@example.com', 1, NULL, 300);
    `)

    await database.exec(
      readFileSync(join(migrationsDirectory, "0144_company_account_profiles.sql"), "utf8"),
    )

    expect(
      await database
        .prepare(
          `SELECT organization_id, account_id, display_name, created_at, updated_at
           FROM company_account_profiles
           ORDER BY account_id`,
        )
        .all(),
    ).toMatchObject({
      results: [
        {
          organization_id: "organization:default",
          account_id: "account-email",
          display_name: "person@example.com",
          created_at: 300,
          updated_at: 400,
        },
        {
          organization_id: "organization:default",
          account_id: "account-id-only",
          display_name: "account-id-only",
          created_at: 500,
          updated_at: 600,
        },
        {
          organization_id: "organization:default",
          account_id: "account-linked",
          display_name: "Linked Employee",
          created_at: 100,
          updated_at: 200,
        },
      ],
    })

    let rejected: unknown
    try {
      await database
        .prepare(
          `INSERT INTO company_account_profiles
             (organization_id, account_id, display_name, created_at, updated_at)
           VALUES ('organization:default', 'account-linked', ' padded ', 0, 0)`,
        )
        .run()
    } catch (caught) {
      rejected = caught
    }
    expect(rejected).toBeInstanceOf(Error)
  })
})
