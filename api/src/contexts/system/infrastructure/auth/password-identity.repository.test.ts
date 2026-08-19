import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/bun-sqlite"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import { PasswordIdentityRepository } from "@/contexts/system/infrastructure/auth/password-identity.repository"
import * as schema from "@/contexts/system/infrastructure/schema/system-runtime"

const changedAt = new Date("2026-08-11T00:00:00.000Z")

function createDatabase(): {
  sqlite: Database
  database: DrizzleD1Database<typeof schema>
} {
  const sqlite = new Database(":memory:")
  sqlite.run(`
    CREATE TABLE users (
      id text PRIMARY KEY,
      name text NOT NULL,
      permissions_changed_at integer,
      disabled_at integer,
      token_version integer NOT NULL DEFAULT 0,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE TABLE user_identities (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      provider text NOT NULL,
      provider_subject text NOT NULL,
      email text,
      password_hash text,
      can_receive_email integer NOT NULL DEFAULT 1,
      email_verified_at integer,
      password_changed_at integer,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE TABLE audit_logs (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      role text NOT NULL,
      action text NOT NULL,
      resource_type text NOT NULL,
      resource_id text,
      metadata text,
      created_at integer NOT NULL
    );
  `)
  sqlite.run(
    "INSERT INTO users (id, name, created_at, updated_at) VALUES ('account-1', 'Account', 0, 0)",
  )
  sqlite.run(
    `INSERT INTO user_identities
       (id, user_id, provider, provider_subject, password_hash, created_at, updated_at)
     VALUES ('identity-1', 'account-1', 'password', 'subject-1', 'old-hash', 0, 0)`,
  )

  const database = drizzle(sqlite, { schema }) as unknown as DrizzleD1Database<typeof schema>
  const withBatch = database as unknown as {
    batch: (statements: ReadonlyArray<PromiseLike<unknown>>) => Promise<unknown[]>
  }
  withBatch.batch = async (statements) => {
    sqlite.run("BEGIN")
    try {
      const results: unknown[] = []
      for (const statement of statements) results.push(await statement)
      sqlite.run("COMMIT")
      return results
    } catch (cause) {
      sqlite.run("ROLLBACK")
      throw cause
    }
  }

  return { sqlite, database }
}

function passwordChange() {
  return WriteOperationEntity.create("change_password", {
    identityId: "identity-1",
    accountId: "account-1",
    actorAccountId: "account-1",
    passwordHash: "new-hash",
    writtenAt: changedAt,
    auditRole: "system_admin",
  })
}

function initialPasswordIssue() {
  return WriteOperationEntity.create("issue_initial_password", {
    identityId: "identity-1",
    accountId: "account-1",
    actorAccountId: "admin-1",
    passwordHash: "issued-hash",
    writtenAt: changedAt,
    auditRole: "system_admin",
  })
}

function initialPasswordSync() {
  return WriteOperationEntity.create("set_initial_password_if_unset", {
    identityId: "identity-1",
    accountId: "account-1",
    actorAccountId: "account-1",
    passwordHash: "synced-hash",
    writtenAt: changedAt,
    auditRole: "system",
  })
}

function credentialState(sqlite: Database) {
  return sqlite
    .query(
      `SELECT password_hash AS passwordHash, token_version AS tokenVersion
       FROM user_identities JOIN users ON users.id = user_identities.user_id`,
    )
    .get()
}

function auditState(sqlite: Database) {
  return sqlite
    .query(
      `SELECT user_id AS userId, role, action, resource_type AS resourceType,
              resource_id AS resourceId, metadata
       FROM audit_logs`,
    )
    .get()
}

describe("PasswordIdentityRepository mandatory audit transaction", () => {
  test("password・token version・System監査を同時に永続化する", async () => {
    const { sqlite, database } = createDatabase()
    const result = await new PasswordIdentityRepository({ var: { database } }).write(
      passwordChange(),
    )

    expect(result).toBe(1)
    expect(credentialState(sqlite)).toEqual({ passwordHash: "new-hash", tokenVersion: 1 })
    expect(auditState(sqlite)).toEqual({
      userId: "account-1",
      role: "system_admin",
      action: "iam.account.password_changed",
      resourceType: "account",
      resourceId: "account-1",
      metadata: null,
    })
  })

  test("管理者による初期password発行はactorとtargetを分けて同時に監査する", async () => {
    const { sqlite, database } = createDatabase()
    const result = await new PasswordIdentityRepository({ var: { database } }).write(
      initialPasswordIssue(),
    )

    expect(result).toBe(1)
    expect(credentialState(sqlite)).toEqual({ passwordHash: "issued-hash", tokenVersion: 1 })
    expect(auditState(sqlite)).toEqual({
      userId: "admin-1",
      role: "system_admin",
      action: "iam.account.password_reset",
      resourceType: "account",
      resourceId: "account-1",
      metadata: '{"source":"initial_password_issue"}',
    })
  })

  test("内部初期password同期は未設定identityだけを更新して同時に監査する", async () => {
    const { sqlite, database } = createDatabase()
    sqlite.run("UPDATE user_identities SET password_hash = NULL")

    const result = await new PasswordIdentityRepository({ var: { database } }).write(
      initialPasswordSync(),
    )

    expect(result).toBe(1)
    expect(credentialState(sqlite)).toEqual({ passwordHash: "synced-hash", tokenVersion: 1 })
    expect(auditState(sqlite)).toEqual({
      userId: "account-1",
      role: "system",
      action: "iam.account.password_reset",
      resourceType: "account",
      resourceId: "account-1",
      metadata: '{"source":"initial_password_sync"}',
    })
  })

  test("監査append失敗はpasswordとtoken versionをrollbackする", async () => {
    const { sqlite, database } = createDatabase()
    sqlite.run(`
      CREATE TRIGGER force_password_change_audit_failure
      BEFORE INSERT ON audit_logs
      BEGIN
        SELECT RAISE(ABORT, 'forced audit failure');
      END
    `)

    const result = await new PasswordIdentityRepository({ var: { database } }).write(
      passwordChange(),
    )

    expect(result).toBeInstanceOf(Error)
    expect(credentialState(sqlite)).toEqual({ passwordHash: "old-hash", tokenVersion: 0 })
    expect(sqlite.query("SELECT count(*) AS total FROM audit_logs").get()).toEqual({ total: 0 })
  })

  test("初期password発行の監査append失敗もcredentialとtoken versionをrollbackする", async () => {
    const { sqlite, database } = createDatabase()
    sqlite.run(`
      CREATE TRIGGER force_initial_password_audit_failure
      BEFORE INSERT ON audit_logs
      BEGIN
        SELECT RAISE(ABORT, 'forced audit failure');
      END
    `)

    const result = await new PasswordIdentityRepository({ var: { database } }).write(
      initialPasswordIssue(),
    )

    expect(result).toBeInstanceOf(Error)
    expect(credentialState(sqlite)).toEqual({ passwordHash: "old-hash", tokenVersion: 0 })
    expect(sqlite.query("SELECT count(*) AS total FROM audit_logs").get()).toEqual({ total: 0 })
  })

  test("内部初期password同期の監査append失敗もcredentialとtoken versionをrollbackする", async () => {
    const { sqlite, database } = createDatabase()
    sqlite.run("UPDATE user_identities SET password_hash = NULL")
    sqlite.run(`
      CREATE TRIGGER force_initial_password_sync_audit_failure
      BEFORE INSERT ON audit_logs
      BEGIN
        SELECT RAISE(ABORT, 'forced audit failure');
      END
    `)

    const result = await new PasswordIdentityRepository({ var: { database } }).write(
      initialPasswordSync(),
    )

    expect(result).toBeInstanceOf(Error)
    expect(credentialState(sqlite)).toEqual({ passwordHash: null, tokenVersion: 0 })
    expect(sqlite.query("SELECT count(*) AS total FROM audit_logs").get()).toEqual({ total: 0 })
  })

  test("設定済みidentityへの内部初期password同期はAccountも監査も変更しない", async () => {
    const { sqlite, database } = createDatabase()

    const result = await new PasswordIdentityRepository({ var: { database } }).write(
      initialPasswordSync(),
    )

    expect(result).toBeInstanceOf(Error)
    expect(credentialState(sqlite)).toEqual({ passwordHash: "old-hash", tokenVersion: 0 })
    expect(sqlite.query("SELECT count(*) AS total FROM audit_logs").get()).toEqual({ total: 0 })
  })

  test("identity不在はAccountだけを失効させない", async () => {
    const { sqlite, database } = createDatabase()
    sqlite.run("DELETE FROM user_identities")

    const result = await new PasswordIdentityRepository({ var: { database } }).write(
      passwordChange(),
    )

    expect(result).toBeInstanceOf(Error)
    expect(sqlite.query("SELECT token_version AS tokenVersion FROM users").get()).toEqual({
      tokenVersion: 0,
    })
    expect(sqlite.query("SELECT count(*) AS total FROM audit_logs").get()).toEqual({ total: 0 })
  })

  test("初期password発行中のAccount不在はcredential更新も監査も残さない", async () => {
    const { sqlite, database } = createDatabase()
    sqlite.run("DELETE FROM users")

    const result = await new PasswordIdentityRepository({ var: { database } }).write(
      initialPasswordIssue(),
    )

    expect(result).toBeInstanceOf(Error)
    expect(sqlite.query("SELECT password_hash AS passwordHash FROM user_identities").get()).toEqual(
      { passwordHash: "old-hash" },
    )
    expect(sqlite.query("SELECT count(*) AS total FROM audit_logs").get()).toEqual({ total: 0 })
  })

  test("identityとAccountの所属不一致はどちらも変更しない", async () => {
    const { sqlite, database } = createDatabase()
    sqlite.run("UPDATE user_identities SET user_id = 'different-account'")

    const result = await new PasswordIdentityRepository({ var: { database } }).write(
      initialPasswordIssue(),
    )

    expect(result).toBeInstanceOf(Error)
    expect(sqlite.query("SELECT password_hash AS passwordHash FROM user_identities").get()).toEqual(
      { passwordHash: "old-hash" },
    )
    expect(sqlite.query("SELECT token_version AS tokenVersion FROM users").get()).toEqual({
      tokenVersion: 0,
    })
    expect(sqlite.query("SELECT count(*) AS total FROM audit_logs").get()).toEqual({ total: 0 })
  })
})
