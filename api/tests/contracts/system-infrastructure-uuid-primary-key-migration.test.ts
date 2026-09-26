import type { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  applyMigration,
  databaseBefore,
  insertBypassingGuards,
  isUuid,
} from "../api/support/uuid-cutover-migration"

const TARGET = "0338_enforce_system_infrastructure_uuid_primary_keys.sql"
const MESSAGE = "5e0f7c3a-1d2b-4c5d-8e6f-000000000001"
const DELIVERY = "5e0f7c3a-1d2b-4c5d-8e6f-000000000002"

/** 新しい UUID の主キーを足した table。旧来の主キーの組は一意な属性として残る。 */
const SURROGATE_TABLES = [
  "system_record_disclosure_policies",
  "system_record_coverage_entries",
  "system_record_retirement_attachment_pins",
  "system_reconciliation_items",
  "system_work_item_revisions",
  "system_operation_receipts",
] as const

function dependents(database: Database) {
  return database
    .query<{ entry: string }, []>(
      `SELECT type || ':' || tbl_name || ':' || name || ':' || sql AS entry FROM sqlite_master
       WHERE type IN ('index', 'trigger') AND tbl_name LIKE 'system\\_%' ESCAPE '\\' AND sql IS NOT NULL`,
    )
    .all()
    .map((row) => row.entry)
}

function seed(database: Database) {
  insertBypassingGuards(
    database,
    "system_batch_jobs",
    `INSERT INTO system_batch_jobs (id, name, status, started_at, finished_at, message) VALUES
       (3, 'sync', 'completed', 10, 20, 'ok'),
       (7, 'notify', 'running', 30, NULL, NULL)`,
  )
  insertBypassingGuards(
    database,
    "system_notification_messages",
    `INSERT INTO system_notification_messages (id, kind, title, source_type, source_id, created_at)
     VALUES ('${MESSAGE}', 'company:task', 'title', 'company:notification.source', '{}', 1)`,
  )
  insertBypassingGuards(
    database,
    "system_notification_deliveries",
    `INSERT INTO system_notification_deliveries (id, message_id, recipient_account_id, delivered_at)
     VALUES ('${DELIVERY}', '${MESSAGE}', 'account', 1)`,
  )
  insertBypassingGuards(
    database,
    "system_operation_receipts",
    `INSERT INTO system_operation_receipts (operation_key, scope_key, command_id, actor_account_id, actor_principal_id, request_digest, result_json, result_digest, recorded_at)
     VALUES ('op', 'scope', 'command', 'account', 'principal', '${"a".repeat(64)}', '{}', '${"b".repeat(64)}', 1)`,
  )
}

test("System の基盤の主キーに UUID の CHECK を課し、整数と複合の主キーを UUID へ移す", () => {
  const database = databaseBefore(TARGET)
  try {
    seed(database)
    const dependentsBefore = dependents(database)
    const violationsBefore = database.query("PRAGMA foreign_key_check").all().length

    applyMigration(database, TARGET)

    const jobs = database
      .query<{ id: string; legacy_id: string; name: string }, []>(
        "SELECT id, legacy_id, name FROM system_batch_jobs ORDER BY legacy_id",
      )
      .all()
    expect(jobs.map(({ legacy_id, name }) => ({ legacy_id, name }))).toEqual([
      { legacy_id: "3", name: "sync" },
      { legacy_id: "7", name: "notify" },
    ])
    expect(jobs.every((job) => isUuid(job.id))).toBe(true)
    expect(
      database.query("SELECT id, message_id FROM system_notification_deliveries").get(),
    ).toEqual({ id: DELIVERY, message_id: MESSAGE })
    const receipt = database
      .query<{ id: string; command_id: string }, []>(
        "SELECT id, command_id FROM system_operation_receipts",
      )
      .get()
    expect(isUuid(receipt?.id)).toBe(true)
    expect(receipt?.command_id).toBe("command")

    // 既存の index と trigger は定義ごと残り、足されるのは識別子を守る trigger だけ。
    const added = dependents(database).filter((entry) => !dependentsBefore.includes(entry))
    expect(dependentsBefore.filter((entry) => !dependents(database).includes(entry))).toEqual([])
    expect(added.map((entry) => entry.split(":").slice(0, 3).join(":")).toSorted()).toEqual(
      [
        ...SURROGATE_TABLES.map((table) => `trigger:${table}:${table}_identity_update`),
        "trigger:system_batch_jobs:system_batch_jobs_identity_update",
        "trigger:system_batch_jobs:system_batch_jobs_legacy_id_insert",
      ].toSorted(),
    )
    expect(database.query("PRAGMA foreign_key_check").all()).toHaveLength(violationsBefore)
    expect(() =>
      database.run(
        "UPDATE system_operation_receipts SET id = lower(hex(randomblob(4))) || '-0000-4000-8000-000000000000'",
      ),
    ).toThrow()
    expect(() =>
      database.run(
        "INSERT INTO system_batch_jobs (id, name, status) VALUES ('not-a-uuid', 'x', 'running')",
      ),
    ).toThrow("CHECK constraint failed")
    expect(
      database
        .query(
          "SELECT name FROM sqlite_master WHERE name LIKE '\\_%' ESCAPE '\\' OR name LIKE '\\_\\_new\\_%' ESCAPE '\\'",
        )
        .all(),
    ).toEqual([])
  } finally {
    database.close()
  }
})

test("UUID でない主キーが残っていれば migration を止める", () => {
  const database = databaseBefore(TARGET)
  try {
    insertBypassingGuards(
      database,
      "system_notification_messages",
      `INSERT INTO system_notification_messages (id, kind, title, source_type, source_id, created_at)
       VALUES ('42', 'company:task', 'title', 'company:notification.source', '{}', 1)`,
    )

    // 行が残ることは transaction で当てる D1 の検査で確かめる。
    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
  } finally {
    database.close()
  }
})
