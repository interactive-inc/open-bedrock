import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { auditLogs } from "@/schema"
import { describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const migrationPath = join(import.meta.dir, "../../../migrations/0015_audit_events.sql")

async function createLegacyDatabase(metadata: string): Promise<D1Database> {
  const db = createD1TestDatabase(`
    CREATE TABLE roles (
      id INTEGER PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE permissions (
      id INTEGER PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      category TEXT NOT NULL
    );
    CREATE TABLE role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission_id)
    );
    INSERT INTO roles (id, key, name, is_system, created_at) VALUES
      (1, 'member', '標準利用者', 1, 0),
      (2, 'manager', '業務管理者', 1, 0),
      (3, 'hr', '人事管理者', 1, 0),
      (4, 'admin', 'システム管理者', 1, 0);

    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY,
      actor_account_id INTEGER,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      metadata TEXT,
      ip TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_account_id);
    CREATE INDEX idx_audit_logs_action ON audit_logs (action);
  `)

  await db
    .prepare(
      `INSERT INTO audit_logs
         (id, actor_account_id, action, target_type, target_id, metadata, ip, created_at)
       VALUES (41, 7, 'employee.updated', 'employee', 101, ?1, '192.0.2.41', 1700000041)`,
    )
    .bind(metadata)
    .run()

  return db
}

async function applyMigration(db: D1Database): Promise<void> {
  const migration = readFileSync(migrationPath, "utf8")

  await db.exec(migration)
}

describe("audit event migration", () => {
  test("copies the legacy row into the append-only audit event shape", async () => {
    const db = await createLegacyDatabase("legacy note")

    await applyMigration(db)

    expect(
      await db.prepare("SELECT count(1) AS count FROM audit_logs").first<number>("count"),
    ).toBe(1)
    expect(await db.prepare("SELECT event_id FROM audit_logs").first<string>("event_id")).toBe(
      "legacy-41",
    )

    const row = await db
      .prepare(
        `SELECT event_id, request_id, actor_account_id, actor_employee_id, action,
                target_type, target_id, typeof(target_id) AS target_id_type, outcome,
                reason_code, authorization_json, before_json, after_json, metadata_json,
                json_valid(metadata_json) AS metadata_is_valid, client_ip, client_name, created_at
         FROM audit_logs WHERE id = 41`,
      )
      .first<Record<string, unknown>>()

    expect(row).toEqual({
      event_id: "legacy-41",
      request_id: "legacy-41",
      actor_account_id: 7,
      actor_employee_id: null,
      action: "employee.updated",
      target_type: "employee",
      target_id: "101",
      target_id_type: "text",
      outcome: "succeeded",
      reason_code: null,
      authorization_json: null,
      before_json: null,
      after_json: null,
      metadata_json: '{"legacy_text":"legacy note"}',
      metadata_is_valid: 1,
      client_ip: "192.0.2.41",
      client_name: "api",
      created_at: 1700000041,
    })

    expect(db.prepare("DELETE FROM audit_logs WHERE id = 41").run()).rejects.toThrow()
    expect(db.prepare("UPDATE audit_logs SET action = 'x' WHERE id = 41").run()).rejects.toThrow()
  })

  test("preserves legacy metadata that is already valid JSON", async () => {
    const db = await createLegacyDatabase('{"source":"legacy"}')

    await applyMigration(db)

    expect(
      await db.prepare("SELECT metadata_json FROM audit_logs").first<string>("metadata_json"),
    ).toBe('{"source":"legacy"}')
  })

  test("enforces event uniqueness and the outcome and client vocabularies", async () => {
    const db = await createLegacyDatabase("legacy note")

    await applyMigration(db)

    expect(
      db
        .prepare(
          `INSERT INTO audit_logs
             (event_id, request_id, action, outcome, client_name, created_at)
           VALUES ('legacy-41', 'request-2', 'duplicate', 'succeeded', 'api', 2)`,
        )
        .run(),
    ).rejects.toThrow()
    expect(
      db
        .prepare(
          `INSERT INTO audit_logs
             (event_id, request_id, action, outcome, client_name, created_at)
           VALUES ('event-2', 'request-2', 'invalid-outcome', 'unknown', 'api', 2)`,
        )
        .run(),
    ).rejects.toThrow()
    expect(
      db
        .prepare(
          `INSERT INTO audit_logs
             (event_id, request_id, action, outcome, client_name, created_at)
           VALUES ('event-3', 'request-3', 'invalid-client', 'succeeded', 'browser', 3)`,
        )
        .run(),
    ).rejects.toThrow()
  })

  test("rejects replacement inserts and preserves the existing audit event", async () => {
    const db = await createLegacyDatabase("legacy note")

    await applyMigration(db)

    expect(
      db
        .prepare(
          `INSERT OR REPLACE INTO audit_logs
             (id, event_id, request_id, action, outcome, client_name, created_at)
           VALUES (41, 'replacement-41', 'replacement-request', 'replaced',
                   'succeeded', 'api', 2)`,
        )
        .run(),
    ).rejects.toThrow()
    expect(
      db
        .prepare(
          `INSERT OR REPLACE INTO audit_logs
             (id, event_id, request_id, action, outcome, client_name, created_at)
           VALUES (42, 'legacy-41', 'replacement-request', 'replaced',
                   'succeeded', 'api', 2)`,
        )
        .run(),
    ).rejects.toThrow()

    expect(
      await db
        .prepare("SELECT event_id, action FROM audit_logs WHERE id = 41")
        .first<{ event_id: string; action: string }>(),
    ).toEqual({ event_id: "legacy-41", action: "employee.updated" })
    expect(
      await db.prepare("SELECT count(1) AS count FROM audit_logs").first<number>("count"),
    ).toBe(1)
  })

  test("adds both audit permissions to the admin system role only", async () => {
    const db = await createLegacyDatabase("legacy note")

    await applyMigration(db)

    const permissions = await db
      .prepare("SELECT key, category FROM permissions WHERE key LIKE 'audit:%' ORDER BY key")
      .all<{ key: string; category: string }>()
    expect(permissions.results).toEqual([
      { key: "audit:export", category: "audit" },
      { key: "audit:read", category: "audit" },
    ])

    const grants = await db
      .prepare(
        `SELECT r.key AS role_key, p.key AS permission_key
         FROM role_permissions rp
         JOIN roles r ON r.id = rp.role_id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE p.key LIKE 'audit:%'
         ORDER BY r.key, p.key`,
      )
      .all<{ role_key: string; permission_key: string }>()
    expect(grants.results).toEqual([
      { role_key: "admin", permission_key: "audit:export" },
      { role_key: "admin", permission_key: "audit:read" },
    ])
  })

  test("keeps the Drizzle audit schema synchronized with the migrated table", async () => {
    const db = await createLegacyDatabase("legacy note")
    await applyMigration(db)
    const database = drizzle(db, { schema: { auditLogs } })

    await database.insert(auditLogs).values({
      eventId: "event-42",
      requestId: "request-42",
      actorAccountId: 8,
      actorEmployeeId: 18,
      action: "employee.updated",
      targetType: "employee",
      targetId: "E018",
      outcome: "succeeded",
      reasonCode: "employee_updated",
      authorizationJson: '{"permission":"employee:update"}',
      beforeJson: '{"status":"inactive"}',
      afterJson: '{"status":"active"}',
      metadataJson: '{"source":"test"}',
      clientIp: "192.0.2.42",
      clientName: "web",
      createdAt: 1700000042,
    })

    const inserted = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.eventId, "event-42"))
      .get()

    expect(inserted).toEqual({
      id: 42,
      eventId: "event-42",
      requestId: "request-42",
      actorAccountId: 8,
      actorEmployeeId: 18,
      action: "employee.updated",
      targetType: "employee",
      targetId: "E018",
      outcome: "succeeded",
      reasonCode: "employee_updated",
      authorizationJson: '{"permission":"employee:update"}',
      beforeJson: '{"status":"inactive"}',
      afterJson: '{"status":"active"}',
      metadataJson: '{"source":"test"}',
      clientIp: "192.0.2.42",
      clientName: "web",
      createdAt: 1700000042,
    })
  })
})
