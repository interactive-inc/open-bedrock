import { afterAll, beforeAll, expect, test } from "bun:test"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import {
  applyLocalD1Migration,
  migrateLocalD1Before,
  seedLocalD1,
} from "@tests/d1/support/migrate-local-d1-before"

const TARGET = "0337_rebuild_audit_tables_with_uuid_primary_keys.sql"

let local: LocalD1

beforeAll(async () => {
  local = await startLocalD1({ empty: ["audit-uuid-migration"] })
}, 120_000)

afterAll(async () => {
  await local.dispose()
})

test("seed 済みのローカルD1で監査の table を空にして作り直し、外部キーの整合を崩さない", async () => {
  const database = await local.database("audit-uuid-migration")
  await migrateLocalD1Before(database, TARGET)
  await seedLocalD1(database)
  // 移行前の形式の監査（UUID でない event_id を含む）を入れておく。
  await database.batch([
    database.prepare(
      "INSERT INTO system_audit_events (event_id, action, target_type, outcome, occurred_at) VALUES ('canonical-company-id:1', 'company.identity.canonicalized', 'employee', 'succeeded', 0)",
    ),
    database.prepare(
      `INSERT INTO company_audit_event_appends (event_id, request_id, action, outcome, client_name, created_at)
       VALUES ('${crypto.randomUUID()}', 'request', 'company.test', 'succeeded', 'system', 1)`,
    ),
  ])

  await applyLocalD1Migration(database, TARGET)

  for (const table of [
    "system_audit_events",
    "company_audit_events",
    "company_audit_append_guard",
  ]) {
    const row = await database.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>()
    expect({ table, n: row?.n }).toEqual({ table, n: 0 })
  }
  expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
  const eventId = crypto.randomUUID()
  await database
    .prepare(
      `INSERT INTO company_audit_event_appends (event_id, request_id, action, outcome, client_name, created_at)
       VALUES (?1, 'request', 'company.test', 'succeeded', 'system', 2)`,
    )
    .bind(eventId)
    .run()
  const event = await database
    .prepare("SELECT id FROM company_audit_events WHERE event_id = ?1")
    .bind(eventId)
    .first<{ id: string }>()
  expect(event?.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
  )
  await expect(
    database
      .prepare(
        "INSERT INTO system_audit_events (event_id, action, target_type, outcome, occurred_at) VALUES ('x', 'x.y.z', 'employee', 'succeeded', 0)",
      )
      .run(),
  ).rejects.toThrow("CHECK constraint failed")
}, 300_000)
