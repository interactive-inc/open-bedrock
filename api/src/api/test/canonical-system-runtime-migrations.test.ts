import { afterEach, describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync, readdirSync } from "node:fs"

const migrationsDirectory = new URL("../../../migrations/", import.meta.url)
const runtimeMigrationFiles = [
  "0142_remove_legacy_refresh_tokens.sql",
  "0143_system_identity_password_backfill.sql",
  "0144_canonical_system_notifications.sql",
  "0145_canonical_system_iam.sql",
] as const
const openDatabases: Array<Database> = []

function createPreRuntimeMigrationDatabase(): Database {
  const database = new Database(":memory:")
  const schemaSql = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql") && file < runtimeMigrationFiles[0])
    .sort()
    .map((file) => readFileSync(new URL(file, migrationsDirectory), "utf8"))
    .join("\n")

  database.exec(schemaSql)
  database.exec("PRAGMA foreign_keys = ON")
  openDatabases.push(database)
  return database
}

function applyMigration(database: Database, file: (typeof runtimeMigrationFiles)[number]): void {
  const sql = readFileSync(new URL(file, migrationsDirectory), "utf8")
  database.transaction(() => database.exec(sql))()
}

function seedLegacySystemState(database: Database, identityProvider = "password"): void {
  database.run(
    `INSERT INTO accounts (id, status, token_version, created_at, updated_at)
     VALUES (41, 'active', 2, 1700000000, 1700000010)`,
  )
  database.run(
    `INSERT INTO identities
       (id, account_id, provider, subject, secret, email, email_verified, created_at)
     VALUES (51, 41, ?, 'person@example.com', ?, 'person@example.com', 1, 1700000001)`,
    [identityProvider, identityProvider === "password" ? "legacy-password-hash-value" : null],
  )
  database.run(
    `INSERT INTO refresh_tokens
       (id, account_id, token_hash, family_id, expires_at, revoked_at, created_at, token_version)
     VALUES (61, 41, ?, 'legacy-family', 1700003600, NULL, 1700000002, 2)`,
    ["a".repeat(64)],
  )
  database.run(
    `INSERT INTO roles (id, key, name, description, is_system, created_at)
     VALUES (7001, 'migration-tester', 'Migration tester', NULL, 0, 1700000003)`,
  )
  database.run(
    `INSERT INTO permissions (id, key, description, category)
     VALUES (8001, 'migration:test:read', 'Migration test permission', 'migration')`,
  )
  database.run("INSERT INTO role_permissions (role_id, permission_id) VALUES (7001, 8001)")
  database.run(
    `INSERT INTO account_roles (account_id, role_id, granted_by, granted_at)
     VALUES (41, 7001, NULL, 1700000004)`,
  )
  database.run(
    `INSERT INTO notifications
       (id, recipient_account_id, source_domain, source_id, kind, title, body, is_read, created_at)
     VALUES
       (91, 41, 'approval', 99, 'approved', 'Approved', 'Request approved', 1,
        '2023-11-14T22:13:25.123Z')`,
  )
}

afterEach(() => {
  for (const database of openDatabases.splice(0)) database.close()
})

describe("0142-0145 canonical System runtime migrations", () => {
  test("session・identity・password・notification・IAMを欠落なくmillisecond時刻で移す", () => {
    const database = createPreRuntimeMigrationDatabase()
    seedLegacySystemState(database)

    for (const migration of runtimeMigrationFiles) applyMigration(database, migration)

    expect(
      database
        .query(
          `SELECT id, account_id, family_id, token_hash, token_version,
                  created_at, expires_at, rotated_at, revoked_at
           FROM system_sessions`,
        )
        .get(),
    ).toEqual({
      id: "legacy:61",
      account_id: "41",
      family_id: "legacy-family",
      token_hash: "a".repeat(64),
      token_version: 2,
      created_at: 1_700_000_002_000,
      expires_at: 1_700_003_600_000,
      rotated_at: null,
      revoked_at: null,
    })
    expect(database.query("SELECT * FROM system_accounts WHERE id = '41'").get()).toMatchObject({
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_010_000,
    })
    expect(
      database.query("SELECT * FROM system_identity_bindings WHERE id = '51'").get(),
    ).toMatchObject({
      account_id: "41",
      provider: "password",
      subject: "person@example.com",
      created_at: 1_700_000_001_000,
      activated_at: 1_700_000_001_000,
      revoked_at: null,
    })
    expect(
      database.query("SELECT * FROM system_password_credentials WHERE identity_id = '51'").get(),
    ).toEqual({
      identity_id: "51",
      password_hash: "legacy-password-hash-value",
      changed_at: 1_700_000_001_000,
      created_at: 1_700_000_001_000,
      updated_at: 1_700_000_001_000,
    })
    expect(
      database.query("SELECT * FROM system_notification_messages WHERE id = '91'").get(),
    ).toMatchObject({
      kind: "company:approved",
      title: "Approved",
      body: "Request approved",
      source_type: "company:notification.source",
      source_id: '{"domain":"approval","id":99}',
      created_at: Date.parse("2023-11-14T22:13:25.123Z"),
    })
    expect(
      database.query("SELECT * FROM system_notification_deliveries WHERE id = '91'").get(),
    ).toMatchObject({
      message_id: "91",
      recipient_account_id: "41",
      delivered_at: Date.parse("2023-11-14T22:13:25.123Z"),
      read_at: Date.parse("2023-11-14T22:13:25.123Z"),
    })
    expect(database.query("SELECT * FROM system_iam_roles WHERE id = '7001'").get()).toMatchObject({
      key: "company:migration-tester",
      kind: "custom",
      name: "Migration tester",
      created_at: 1_700_000_003_000,
      updated_at: 1_700_000_003_000,
    })
    expect(
      database.query("SELECT * FROM system_iam_role_permissions WHERE role_id = '7001'").all(),
    ).toEqual([{ role_id: "7001", permission_key: "migration:test:read" }])
    expect(database.query("SELECT * FROM system_role_bindings WHERE account_id = '41'").all()).toEqual([
      {
        id: "legacy:41:7001",
        account_id: "41",
        role_id: "7001",
        resource_type: null,
        resource_id: null,
        created_at: 1_700_000_004_000,
        revoked_at: null,
      },
    ])
    expect(
      database
        .query(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name IN ('refresh_tokens', 'notifications')`,
        )
        .all(),
    ).toEqual([])
    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([])
  })

  test("移行後のlegacy identity書き込みを同期し、identity改変と未対応providerを拒否する", () => {
    const database = createPreRuntimeMigrationDatabase()
    seedLegacySystemState(database)
    for (const migration of runtimeMigrationFiles) applyMigration(database, migration)

    database.run(
      `INSERT INTO identities
         (id, account_id, provider, subject, secret, email, email_verified, created_at)
       VALUES (52, 41, 'password', 'second@example.com', ?, 'second@example.com', 1, 1700000100)`,
      ["second-password-hash-value"],
    )
    expect(database.query("SELECT * FROM system_identity_bindings WHERE id = '52'").get()).toMatchObject(
      { created_at: 1_700_000_100_000, activated_at: 1_700_000_100_000 },
    )

    database.run("UPDATE identities SET secret = ? WHERE id = 52", [
      "rotated-password-hash-value",
    ])
    expect(
      database
        .query("SELECT password_hash FROM system_password_credentials WHERE identity_id = '52'")
        .get(),
    ).toEqual({ password_hash: "rotated-password-hash-value" })

    expect(() =>
      database.run("UPDATE identities SET subject = 'attacker@example.com' WHERE id = 52"),
    ).toThrow()
    expect(() =>
      database.run(
        `INSERT INTO identities
           (id, account_id, provider, subject, secret, email, email_verified, created_at)
         VALUES (53, 41, 'saml', 'saml-subject', NULL, NULL, 0, 1700000200)`,
      ),
    ).toThrow()

    database.run("DELETE FROM identities WHERE id = 52")
    expect(database.query("SELECT * FROM system_identity_bindings WHERE id = '52'").get()).toBeNull()
    expect(
      database.query("SELECT * FROM system_password_credentials WHERE identity_id = '52'").get(),
    ).toBeNull()
  })

  test("未対応identity providerがあれば0143全体をrollbackする", () => {
    const database = createPreRuntimeMigrationDatabase()
    seedLegacySystemState(database, "saml")
    expect(database.query("SELECT provider FROM identities WHERE id = 51").get()).toEqual({
      provider: "saml",
    })
    applyMigration(database, "0142_remove_legacy_refresh_tokens.sql")

    expect(() => applyMigration(database, "0143_system_identity_password_backfill.sql")).toThrow()
    expect(database.query("SELECT * FROM system_identity_bindings").all()).toEqual([])
    expect(database.query("SELECT created_at FROM system_accounts WHERE id = '41'").get()).toEqual({
      created_at: 1_700_000_000,
    })
    expect(
      database
        .query(
          `SELECT count(*) AS count FROM sqlite_master
           WHERE type = 'trigger' AND name LIKE 'system_accounts_legacy_accounts_%'`,
        )
        .get(),
    ).toEqual({ count: 6 })
  })
})
