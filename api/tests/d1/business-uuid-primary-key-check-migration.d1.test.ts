import { afterAll, beforeAll, expect, test } from "bun:test"
import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import {
  applyLocalD1Migration,
  migrateLocalD1Before,
  seedLocalD1,
} from "@tests/d1/support/migrate-local-d1-before"

const TARGET = "0328_enforce_business_uuid_primary_keys.sql"

const TABLES = [
  "antisocial_checks",
  "business_trips",
  "certificate_requests",
  "family_care_leaves",
  "life_events",
  "rental_reservations",
  "resignations",
  "room_reservations",
  "one_on_ones",
  "stocktakes",
  "stocktake_items",
] as const

let local: LocalD1

beforeAll(async () => {
  local = await startLocalD1({ empty: ["uuid-check-migration"] })
}, 120_000)

afterAll(async () => {
  await local.dispose()
})

async function snapshot(database: D1Database) {
  const counts: Record<string, number> = {}
  for (const table of TABLES) {
    const row = await database
      .prepare(`SELECT count(*) AS count FROM ${table}`)
      .first<{ count: number }>()
    counts[table] = row?.count ?? -1
  }
  const objects = await database
    .prepare(
      `SELECT type, name, tbl_name FROM sqlite_master
       WHERE type IN ('index', 'trigger') AND sql IS NOT NULL
         AND tbl_name IN (${TABLES.map((table) => `'${table}'`).join(",")})
       ORDER BY type, name`,
    )
    .all()
  return { counts, objects: objects.results }
}

test("seed 済みのローカルD1で行数と index と trigger を保ち、外部キーの整合を崩さない", async () => {
  const database = await local.database("uuid-check-migration")
  await migrateLocalD1Before(database, TARGET)
  await seedLocalD1(database)
  // 旧 seed の version 0 の疑似 UUID を持つ行。置き換えと参照の追従を D1 でも通す。
  await database.batch([
    database.prepare(
      "INSERT INTO stocktakes (id, name, target_date, status, created_at) VALUES ('00000000-0000-0000-0000-00000000000a', 'legacy', '2025-01-01', 'closed', '2025-01-01T00:00:00Z')",
    ),
    database.prepare(
      "INSERT INTO stocktake_items (stocktake_id, asset_code) VALUES ('00000000-0000-0000-0000-00000000000a', 'LEGACY-1')",
    ),
  ])
  const before = await snapshot(database)

  await applyLocalD1Migration(database, TARGET)

  const after = await snapshot(database)
  expect(after).toEqual(before)
  expect(Object.values(after.counts).some((count) => count > 0)).toBe(true)
  expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
  for (const table of TABLES.filter((table) => table !== "stocktake_items")) {
    const invalid = await database
      .prepare(`SELECT count(*) AS count FROM ${table} WHERE NOT (${uuidCheckPredicate("id")})`)
      .first<{ count: number }>()
    expect({ table, invalid: invalid?.count }).toEqual({ table, invalid: 0 })
  }
  const orphanItems = await database
    .prepare(
      "SELECT count(*) AS count FROM stocktake_items item LEFT JOIN stocktakes stocktake ON stocktake.id = item.stocktake_id WHERE stocktake.id IS NULL",
    )
    .first<{ count: number }>()
  expect(orphanItems?.count).toBe(0)
  await expect(
    database
      .prepare(
        "INSERT INTO stocktakes (id, name, target_date, status, created_at) VALUES ('1', 'x', '2026-01-01', 'open', '2026-01-01T00:00:00Z')",
      )
      .run(),
  ).rejects.toThrow("CHECK constraint failed")
}, 300_000)
