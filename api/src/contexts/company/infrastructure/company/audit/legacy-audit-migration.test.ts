import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import {
  auditBatchDecisions,
  auditLogs,
} from "@/contexts/system/infrastructure/schema/compatibility/account-schema"
import { describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const auditEventsMigrationPath = join(
  import.meta.dir,
  "../../../../../../migrations/0015_audit_events.sql",
)
const appendGuardMigrationPath = join(
  import.meta.dir,
  "../../../../../../migrations/0016_audit_append_guard.sql",
)
const batchDecisionMigrationPath = join(
  import.meta.dir,
  "../../../../../../migrations/0017_audit_batch_decisions.sql",
)

type LegacyRowOverrides = {
  id?: number
  targetType?: string | null
  targetId?: number | null
}

async function createLegacyDatabase(
  metadata: string,
  overrides: LegacyRowOverrides = {},
): Promise<D1Database> {
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
       VALUES (?1, 7, 'employee.updated', ?2, ?3, ?4, '192.0.2.41', 1700000041)`,
    )
    .bind(
      overrides.id ?? 41,
      overrides.targetType === undefined ? "employee" : overrides.targetType,
      overrides.targetId === undefined ? 101 : overrides.targetId,
      metadata,
    )
    .run()

  return db
}

async function applyMigration(db: D1Database, path: string): Promise<void> {
  const migration = readFileSync(path, "utf8")

  await db.exec(migration)
}

async function applyAuditEventsMigration(db: D1Database): Promise<void> {
  await applyMigration(db, auditEventsMigrationPath)
}

async function applyAppendGuardMigration(db: D1Database): Promise<void> {
  await applyMigration(db, appendGuardMigrationPath)
}

async function applyBatchDecisionMigration(db: D1Database): Promise<void> {
  await applyMigration(db, batchDecisionMigrationPath)
}

/**
 * 0114 のうち audit に関わる部分だけを再現する。0114 は 21 表を一括で改名するため、
 * audit 系の表しか持たないこの fixture にはそのまま適用できない。
 */
async function applyTablesRenameMigration(db: D1Database): Promise<void> {
  await db.exec("ALTER TABLE audit_logs RENAME TO audit_events;")
  await db.exec("DROP TRIGGER audit_logs_append_guard_prevent_insert;")
  await db.exec(
    `CREATE TRIGGER audit_events_append_guard_prevent_insert
     BEFORE INSERT ON audit_logs_append_guard
     WHEN
       NOT EXISTS (
         SELECT 1 FROM audit_events WHERE id = NEW.audit_id AND event_id = NEW.event_id
       )
       OR EXISTS (
         SELECT 1 FROM audit_logs_append_guard
         WHERE audit_id = NEW.audit_id OR event_id = NEW.event_id
       )
     BEGIN
       SELECT RAISE(ABORT, 'audit_events append guard is immutable');
     END;`,
  )
}

async function applyMigrations(db: D1Database): Promise<void> {
  await applyAuditEventsMigration(db)
  await applyAppendGuardMigration(db)
  await applyBatchDecisionMigration(db)
}

describe("audit event migration", () => {
  test("keeps the published 0015 migration byte-for-byte immutable", () => {
    const migration = readFileSync(auditEventsMigrationPath)

    expect(createHash("sha256").update(migration).digest("hex")).toBe(
      "a6b699fe5655445dfc97501acdf97c827a219c84498975b63be70963b151bee5",
    )
  })

  test("upgrades and guards rows written after 0015 before 0016", async () => {
    const db = await createLegacyDatabase("legacy note")

    await applyAuditEventsMigration(db)

    expect(
      await db
        .prepare(
          `SELECT name
           FROM sqlite_master
           WHERE type = 'table' AND name = 'audit_logs_append_guard'`,
        )
        .first<string>("name"),
    ).toBeNull()

    await db
      .prepare(
        `INSERT INTO audit_logs
           (event_id, request_id, action, outcome, client_name, created_at)
         VALUES ('event-post-0015', 'request-post-0015', 'employee.updated',
                 'succeeded', 'api', 1700000042)`,
      )
      .run()

    await applyAppendGuardMigration(db)

    expect(
      (
        await db
          .prepare(
            `SELECT audit_id, event_id
             FROM audit_logs_append_guard
             ORDER BY audit_id`,
          )
          .all<{ audit_id: number; event_id: string }>()
      ).results,
    ).toEqual([
      { audit_id: 41, event_id: "legacy-41" },
      { audit_id: 42, event_id: "event-post-0015" },
    ])

    await applyAppendGuardMigration(db)

    expect(
      await db
        .prepare("SELECT count(1) AS count FROM audit_logs_append_guard")
        .first<number>("count"),
    ).toBe(2)
  })

  test("copies the legacy row into the append-only audit event shape", async () => {
    const db = await createLegacyDatabase("legacy note")

    await applyMigrations(db)

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

    await applyMigrations(db)

    expect(
      await db.prepare("SELECT metadata_json FROM audit_logs").first<string>("metadata_json"),
    ).toBe('{"source":"legacy"}')
  })

  test("preserves nullable legacy target fields", async () => {
    const db = await createLegacyDatabase("legacy note", {
      targetType: null,
      targetId: null,
    })

    await applyMigrations(db)

    expect(
      await db
        .prepare("SELECT target_type, target_id FROM audit_logs WHERE id = 41")
        .first<{ target_type: string | null; target_id: string | null }>(),
    ).toEqual({ target_type: null, target_id: null })
  })

  test("enforces event uniqueness and the outcome and client vocabularies", async () => {
    const db = await createLegacyDatabase("legacy note")

    await applyMigrations(db)

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

    await applyMigrations(db)

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

  test("allows automatic IDs after migrating a negative legacy ID without allowing replacement", async () => {
    const db = await createLegacyDatabase("legacy note", { id: -1 })

    await applyMigrations(db)

    await db
      .prepare(
        `INSERT INTO audit_logs
           (event_id, request_id, action, outcome, client_name, created_at)
         VALUES ('event-auto', 'request-auto', 'employee.updated',
                 'succeeded', 'api', 1700000042)`,
      )
      .run()

    expect(
      db
        .prepare(
          `INSERT OR REPLACE INTO audit_logs
             (id, event_id, request_id, action, outcome, client_name, created_at)
           VALUES (-1, 'replacement-by-id', 'replacement-request', 'replaced',
                   'succeeded', 'api', 2)`,
        )
        .run(),
    ).rejects.toThrow()
    expect(
      db
        .prepare(
          `INSERT OR REPLACE INTO audit_logs
             (id, event_id, request_id, action, outcome, client_name, created_at)
           VALUES (50, 'legacy--1', 'replacement-request', 'replaced',
                   'succeeded', 'api', 2)`,
        )
        .run(),
    ).rejects.toThrow()
    expect(
      db
        .prepare(
          `INSERT OR REPLACE INTO audit_logs
             (id, event_id, request_id, action, outcome, client_name, created_at)
           VALUES (50, 'event-auto', 'replacement-request', 'replaced',
                   'succeeded', 'api', 2)`,
        )
        .run(),
    ).rejects.toThrow()

    expect(
      await db
        .prepare("SELECT event_id, action FROM audit_logs WHERE id = -1")
        .first<{ event_id: string; action: string }>(),
    ).toEqual({ event_id: "legacy--1", action: "employee.updated" })
    expect(
      await db.prepare("SELECT count(1) AS count FROM audit_logs").first<number>("count"),
    ).toBe(2)
    expect(
      await db
        .prepare(
          `SELECT g.event_id
           FROM audit_logs_append_guard g
           JOIN audit_logs a ON a.id = g.audit_id AND a.event_id = g.event_id
           WHERE g.event_id = 'event-auto'`,
        )
        .first<string>("event_id"),
    ).toBe("event-auto")
    expect(
      await db
        .prepare("SELECT count(1) AS count FROM audit_logs_append_guard")
        .first<number>("count"),
    ).toBe(2)
  })

  test("rejects direct modification of the append-only guard", async () => {
    const db = await createLegacyDatabase("legacy note")

    await applyMigrations(db)

    expect(
      db
        .prepare(
          `INSERT INTO audit_logs_append_guard (audit_id, event_id)
           VALUES (99, 'fabricated-event')`,
        )
        .run(),
    ).rejects.toThrow()
    expect(
      db
        .prepare(
          `INSERT OR REPLACE INTO audit_logs_append_guard (audit_id, event_id)
           VALUES (41, 'replacement-event')`,
        )
        .run(),
    ).rejects.toThrow()
    expect(
      db
        .prepare(
          `UPDATE audit_logs_append_guard
           SET event_id = 'replacement-event'
           WHERE audit_id = 41`,
        )
        .run(),
    ).rejects.toThrow()
    expect(
      db.prepare("DELETE FROM audit_logs_append_guard WHERE audit_id = 41").run(),
    ).rejects.toThrow()

    expect(
      await db
        .prepare("SELECT audit_id, event_id FROM audit_logs_append_guard")
        .first<{ audit_id: number; event_id: string }>(),
    ).toEqual({ audit_id: 41, event_id: "legacy-41" })
  })

  test("adds both audit permissions to the admin system role only", async () => {
    const db = await createLegacyDatabase("legacy note")

    await applyMigrations(db)

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
    await applyMigrations(db)
    // schema.ts は 0114 改名後の audit_events を指すため、この検証だけ改名まで進める。
    await applyTablesRenameMigration(db)
    const database = drizzle(db, { schema: { auditLogs } })

    await database.insert(auditLogs).values({
      eventId: "event-42",
      requestId: "request-42",
      actorAccountId: 8,
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

  test("adds a bounded transaction-local audit decision table", async () => {
    const db = await createLegacyDatabase("legacy note")
    await applyMigrations(db)
    const database = drizzle(db, { schema: { auditBatchDecisions } })

    expect(
      await db
        .prepare(
          `SELECT sql
           FROM sqlite_master
           WHERE type = 'table' AND name = 'audit_batch_decisions'`,
        )
        .first<string>("sql"),
    ).toContain("WITHOUT ROWID")

    await database.insert(auditBatchDecisions).values({
      decisionId: "00000000-0000-4000-8000-000000000001",
      decisionValue: "rotated",
    })
    expect(await database.select().from(auditBatchDecisions).get()).toEqual({
      decisionId: "00000000-0000-4000-8000-000000000001",
      decisionValue: "rotated",
    })

    expect(
      db
        .prepare(
          `INSERT INTO audit_batch_decisions (decision_id, decision_value)
           VALUES (?1, ?2)`,
        )
        .bind("x".repeat(201), "rotated")
        .run(),
    ).rejects.toThrow()
    expect(
      db
        .prepare(
          `INSERT INTO audit_batch_decisions (decision_id, decision_value)
           VALUES (?1, ?2)`,
        )
        .bind("00000000-0000-4000-8000-000000000002", "")
        .run(),
    ).rejects.toThrow()
  })
})
