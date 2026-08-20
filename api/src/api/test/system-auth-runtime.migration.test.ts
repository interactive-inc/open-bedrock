import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const migrationsDirectory = join(import.meta.dir, "../../../migrations")

describe("0145 canonical System authentication runtime", () => {
  test("password reset challengeと共有authentication attemptだけを追加する", async () => {
    const releasedSchema = readdirSync(migrationsDirectory)
      .filter((file) => file.endsWith(".sql") && file <= "0144_company_account_profiles.sql")
      .sort()
      .map((file) => readFileSync(join(migrationsDirectory, file), "utf8"))
      .join("\n")
    const database = createD1TestDatabase(releasedSchema)

    await database.exec(
      readFileSync(join(migrationsDirectory, "0145_finalize_system_auth_runtime.sql"), "utf8"),
    )
    expect(
      await database
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name IN (
             'login_attempts',
             'password_reset_tokens',
             'system_authentication_attempts',
             'system_password_reset_challenges'
           )
           ORDER BY name`,
        )
        .all(),
    ).toMatchObject({
      results: [
        { name: "system_authentication_attempts" },
        { name: "system_password_reset_challenges" },
      ],
    })

    await database.exec(`
      INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
        VALUES ('account-1', 'active', 0, 0, 0);
      INSERT INTO system_identity_bindings
        (id, account_id, provider, subject, created_at, activated_at, revoked_at)
        VALUES ('identity-1', 'account-1', 'password', 'person@example.com', 0, 0, NULL);
      INSERT INTO system_password_credentials
        (identity_id, password_hash, changed_at, created_at, updated_at)
        VALUES ('identity-1', '${"x".repeat(20)}', 0, 0, 0);
      INSERT INTO system_password_reset_challenges
        (id, token_hash, account_id, identity_id, created_at, expires_at, used_at)
        VALUES ('challenge-1', '${"a".repeat(64)}', 'account-1', 'identity-1', 10, 20, NULL);
      UPDATE system_password_reset_challenges SET used_at = 15 WHERE id = 'challenge-1';
    `)
    expect(
      await database
        .prepare(
          `SELECT token_hash, used_at FROM system_password_reset_challenges
           WHERE id = 'challenge-1'`,
        )
        .first<{ token_hash: string; used_at: number }>(),
    ).toEqual({ token_hash: "a".repeat(64), used_at: 15 })

    let secondUseRejected: unknown
    try {
      await database
        .prepare(
          "UPDATE system_password_reset_challenges SET used_at = 16 WHERE id = 'challenge-1'",
        )
        .run()
    } catch (caught) {
      secondUseRejected = caught
    }
    expect(secondUseRejected).toBeInstanceOf(Error)
  })
})
