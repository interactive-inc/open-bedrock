import { loadSchema } from "@/interface/test-helpers/load-schema"
import { systemCoreSchema } from "@/schema/system-core"
import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { getTableConfig } from "drizzle-orm/sqlite-core"

function createDatabase(): Database {
  const database = new Database(":memory:")
  database.exec(loadSchema())
  database.exec("PRAGMA foreign_keys = ON")
  return database
}

function insertAccount(database: Database, id: string = "account-1"): void {
  database.run(
    `INSERT INTO system_accounts
       (id, status, token_version, created_at, updated_at)
     VALUES (?, 'active', 0, 100, 100)`,
    [id],
  )
}

function insertRole(database: Database): void {
  database.run(
    `INSERT INTO system_iam_roles
       (id, key, kind, name, created_at, updated_at)
     VALUES ('role-root', 'system:admin', 'managed', 'System root', 100, 100)`,
  )
}

describe("0126 canonical System core schema", () => {
  test("Drizzle declarationとmigrationのtable・columnを一致させ、System外FKを持たない", () => {
    const database = createDatabase()
    const declaredTables = Object.values(systemCoreSchema)
      .map((table) => getTableConfig(table))
      .sort((left, right) => left.name.localeCompare(right.name))

    expect(declaredTables.map(({ name }) => name)).toEqual([
      "system_accounts",
      "system_audit_events",
      "system_bootstrap_state",
      "system_iam_role_permissions",
      "system_iam_roles",
      "system_identity_bindings",
      "system_notification_deliveries",
      "system_notification_messages",
      "system_password_credentials",
      "system_role_bindings",
      "system_sessions",
    ])

    for (const table of declaredTables) {
      const databaseColumns = database
        .query<{ name: string }, []>(`PRAGMA table_info(${table.name})`)
        .all()
        .map((column) => column.name)
      const foreignTables = database
        .query<{ table: string }, []>(`PRAGMA foreign_key_list(${table.name})`)
        .all()
        .map((foreignKey) => foreignKey.table)

      expect(databaseColumns).toEqual(table.columns.map((column) => column.name))
      expect(foreignTables.every((foreignTable) => foreignTable.startsWith("system_"))).toBe(true)
    }

    const passwordColumns = database
      .query<{ name: string }, []>("PRAGMA table_info(system_password_credentials)")
      .all()
      .map((column) => column.name)
    const sessionColumns = database
      .query<{ name: string }, []>("PRAGMA table_info(system_sessions)")
      .all()
      .map((column) => column.name)

    expect(passwordColumns).toContain("password_hash")
    expect(passwordColumns).not.toContain("password")
    expect(sessionColumns).toContain("token_hash")
    expect(sessionColumns).not.toContain("token")
    database.close()
  })

  test("Account・Identity・credential・Sessionの型、一意性、時系列をfail closedにする", () => {
    const database = createDatabase()

    expect(() =>
      database.run(
        `INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES ('invalid', 'disabled', 0, 100, 100)`,
      ),
    ).toThrow()
    insertAccount(database)
    expect(() =>
      database.run(
        "UPDATE system_accounts SET status = 'locked', updated_at = 101 WHERE id = 'account-1'",
      ),
    ).toThrow()
    database.run(
      `UPDATE system_accounts
       SET status = 'locked', token_version = 1, updated_at = 101
       WHERE id = 'account-1'`,
    )
    expect(() =>
      database.run(
        "UPDATE system_accounts SET token_version = 0, updated_at = 102 WHERE id = 'account-1'",
      ),
    ).toThrow()

    database.run(
      `INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at)
       VALUES ('identity-password', 'account-1', 'password', 'User@Example.test', 100, 100)`,
    )
    expect(() =>
      database.run(
        `INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at)
         VALUES ('identity-duplicate', 'account-1', 'password', 'User@Example.test', 100, 100)`,
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at)
       VALUES ('identity-google', 'account-1', 'google', 'subject-1', 100, 100)`,
    )
    expect(() =>
      database.run(
        `INSERT INTO system_password_credentials
           (identity_id, password_hash, changed_at, created_at, updated_at)
         VALUES ('identity-google', ?, 100, 100, 100)`,
        ["h".repeat(64)],
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_password_credentials
         (identity_id, password_hash, changed_at, created_at, updated_at)
       VALUES ('identity-password', ?, 100, 100, 100)`,
      ["h".repeat(64)],
    )
    expect(() =>
      database.run(
        `UPDATE system_password_credentials
         SET changed_at = 99, updated_at = 101
         WHERE identity_id = 'identity-password'`,
      ),
    ).toThrow()
    expect(() =>
      database.run(
        `UPDATE system_identity_bindings
         SET activated_at = 101
         WHERE id = 'identity-password'`,
      ),
    ).toThrow()

    expect(() =>
      database.run(
        `INSERT INTO system_sessions
           (id, account_id, family_id, token_hash, token_version, created_at, expires_at)
         VALUES ('bad-session', 'account-1', 'family-1', ?, 0, 100, 100)`,
        ["a".repeat(64)],
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_sessions
         (id, account_id, family_id, token_hash, token_version, created_at, expires_at)
       VALUES ('session-1', 'account-1', 'family-1', ?, 0, 100, 200)`,
      ["a".repeat(64)],
    )
    database.run("UPDATE system_sessions SET rotated_at = 150 WHERE id = 'session-1'")
    expect(() =>
      database.run("UPDATE system_sessions SET rotated_at = 160 WHERE id = 'session-1'"),
    ).toThrow()
    database.run("UPDATE system_sessions SET revoked_at = 170 WHERE id = 'session-1'")
    expect(() =>
      database.run("UPDATE system_sessions SET revoked_at = 180 WHERE id = 'session-1'"),
    ).toThrow()
    expect(() =>
      database.run(
        `INSERT INTO system_sessions
           (id, account_id, family_id, token_hash, token_version, created_at, expires_at)
         VALUES ('session-2', 'account-1', 'family-1', ?, 0, 100, 200)`,
        ["a".repeat(64)],
      ),
    ).toThrow()

    database.close()
  })

  test("IAM resource pair・active binding一意性・System-only bootstrapをDBで守る", () => {
    const database = createDatabase()
    insertAccount(database)
    insertRole(database)
    database.run(
      `INSERT INTO system_role_bindings
         (id, account_id, role_id, resource_type, resource_id, created_at)
       VALUES ('binding-root', 'account-1', 'role-root', NULL, NULL, 100)`,
    )
    expect(() =>
      database.run(
        `INSERT INTO system_bootstrap_state
           (singleton, completed_by_account_id, root_binding_id, completed_at)
         VALUES (1, 'account-1', 'binding-root', 100)`,
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_iam_role_permissions (role_id, permission_key)
       VALUES ('role-root', 'system:admin')`,
    )

    expect(() =>
      database.run(
        `INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at)
         VALUES ('binding-duplicate', 'account-1', 'role-root', NULL, NULL, 101)`,
      ),
    ).toThrow()
    expect(() =>
      database.run(
        `INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at)
         VALUES ('binding-half-resource', 'account-1', 'role-root', 'facility:read', NULL, 100)`,
      ),
    ).toThrow()
    expect(() =>
      database.run(
        `INSERT INTO system_bootstrap_state
           (singleton, completed_by_account_id, root_binding_id, completed_at)
         VALUES (2, 'account-1', 'binding-root', 100)`,
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_bootstrap_state
         (singleton, completed_by_account_id, root_binding_id, completed_at)
       VALUES (1, 'account-1', 'binding-root', 100)`,
    )

    expect(
      database.query("SELECT completed_by_account_id FROM system_bootstrap_state").get(),
    ).toEqual({ completed_by_account_id: "account-1" })
    expect(() =>
      database.run("UPDATE system_bootstrap_state SET completed_at = 101 WHERE singleton = 1"),
    ).toThrow()
    expect(() => database.run("DELETE FROM system_bootstrap_state WHERE singleton = 1")).toThrow()
    expect(() =>
      database.run("UPDATE system_role_bindings SET created_at = 101 WHERE id = 'binding-root'"),
    ).toThrow()
    database.run("UPDATE system_role_bindings SET revoked_at = 110 WHERE id = 'binding-root'")
    expect(() =>
      database.run("UPDATE system_role_bindings SET revoked_at = 120 WHERE id = 'binding-root'"),
    ).toThrow()
    database.close()
  })

  test("Notification messageをimmutableにし、Account delivery/readを一意かつ単調にする", () => {
    const database = createDatabase()
    insertAccount(database)

    expect(() =>
      database.run(
        `INSERT INTO system_notification_messages
           (id, kind, title, source_type, source_id, created_at)
         VALUES ('bad-message', 'system:test', 'Bad', 'care:event', NULL, 100)`,
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_notification_messages
         (id, kind, title, body, source_type, source_id, created_at)
       VALUES ('message-1', 'system:test', 'Title', 'Body', 'care:event', 'event-1', 100)`,
    )
    expect(() =>
      database.run(
        "UPDATE system_notification_messages SET title = 'Changed' WHERE id = 'message-1'",
      ),
    ).toThrow()

    expect(() =>
      database.run(
        `INSERT INTO system_notification_deliveries
           (id, message_id, recipient_account_id, delivered_at, read_at)
         VALUES ('delivery-bad', 'message-1', 'account-1', 100, 99)`,
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_notification_deliveries
         (id, message_id, recipient_account_id, delivered_at)
       VALUES ('delivery-1', 'message-1', 'account-1', 100)`,
    )
    expect(() =>
      database.run(
        `INSERT INTO system_notification_deliveries
           (id, message_id, recipient_account_id, delivered_at)
         VALUES ('delivery-duplicate', 'message-1', 'account-1', 101)`,
      ),
    ).toThrow()
    database.run("UPDATE system_notification_deliveries SET read_at = 110 WHERE id = 'delivery-1'")
    expect(() =>
      database.run(
        "UPDATE system_notification_deliveries SET read_at = 120 WHERE id = 'delivery-1'",
      ),
    ).toThrow()

    database.close()
  })

  test("audit actorをAccount FKから切り離し、eventをappend-onlyにする", () => {
    const database = createDatabase()
    database.run(
      `INSERT INTO system_audit_events
         (event_id, actor_account_id, action, target_type, target_id, outcome, occurred_at)
       VALUES ('audit-1', 'deleted-account', 'system.account.locked', 'system:account',
               'account-1', 'succeeded', 100)`,
    )
    expect(() =>
      database.run(
        `INSERT INTO system_audit_events
           (event_id, action, target_type, outcome, metadata_json, occurred_at)
         VALUES ('audit-invalid-json', 'system.account.locked', 'system:account',
                 'failed', '{', 101)`,
      ),
    ).toThrow()

    expect(() =>
      database.run("UPDATE system_audit_events SET outcome = 'failed' WHERE event_id = 'audit-1'"),
    ).toThrow()
    expect(() =>
      database.run("DELETE FROM system_audit_events WHERE event_id = 'audit-1'"),
    ).toThrow()

    expect(database.query("SELECT actor_account_id FROM system_audit_events").get()).toEqual({
      actor_account_id: "deleted-account",
    })
    database.close()
  })
})
