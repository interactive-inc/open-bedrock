import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const migrationsDirectory = join(import.meta.dir, "../../../../../migrations")

describe("0146 canonical System OIDC storage", () => {
  test("旧System tableを削除してOIDC tokenをcanonical Accountへ束縛する", async () => {
    const releasedSchema = readdirSync(migrationsDirectory)
      .filter((file) => file.endsWith(".sql") && file <= "0145_finalize_system_auth_runtime.sql")
      .sort()
      .map((file) => readFileSync(join(migrationsDirectory, file), "utf8"))
      .join("\n")
    const database = createD1TestDatabase(releasedSchema)
    await database.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE user_identities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id)
      );
      CREATE TABLE oidc_authorization_codes (
        code_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id)
      );
      CREATE TABLE oidc_access_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id)
      );
      CREATE TABLE bootstrap_state (singleton INTEGER PRIMARY KEY);
      CREATE TABLE entity_id_aliases (legacy_id TEXT PRIMARY KEY);
      CREATE TABLE deleted_records (id TEXT PRIMARY KEY);
    `)

    await database.exec(
      readFileSync(join(migrationsDirectory, "0146_finalize_system_oidc_storage.sql"), "utf8"),
    )

    const tables = await database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN (
           'users',
           'user_identities',
           'bootstrap_state',
           'entity_id_aliases',
           'deleted_records',
           'oidc_authorization_codes',
           'oidc_access_tokens',
           'system_oidc_authorization_codes',
           'system_oidc_access_tokens'
         )
         ORDER BY name`,
      )
      .all()

    expect(tables).toMatchObject({
      results: [{ name: "system_oidc_access_tokens" }, { name: "system_oidc_authorization_codes" }],
    })

    await database.exec(`
      INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
        VALUES ('account-1', 'active', 0, 0, 0);
      INSERT INTO system_oidc_authorization_codes
        (code_hash, issuer, client_id, redirect_uri, account_id, code_challenge,
         nonce, scope, expires_at, created_at)
        VALUES (
          '${"a".repeat(64)}',
          'https://identity.example.test',
          'system-console',
          'https://console.example.test/callback',
          'account-1',
          'challenge',
          'nonce',
          'openid',
          10,
          0
        );
    `)

    expect(await database.prepare("PRAGMA foreign_key_check").all()).toMatchObject({ results: [] })
  })
})
