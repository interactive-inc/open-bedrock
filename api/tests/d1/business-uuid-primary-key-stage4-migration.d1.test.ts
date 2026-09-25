import { afterAll, beforeAll, expect, test } from "bun:test"
import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import {
  applyLocalD1Migration,
  migrateLocalD1Before,
  seedLocalD1,
} from "@tests/d1/support/migrate-local-d1-before"

const TARGET = "0331_convert_business_uuid_primary_keys_stage4.sql"

const TABLES = [
  "rooms",
  "shift_patterns",
  "shift_assignments",
  "shift_swap_requests",
  "surveys",
  "survey_responses",
  "thanks_rewards",
  "thanks_messages",
  "thanks_point_budgets",
  "thanks_redemptions",
  "training_courses",
  "training_enrollments",
  "job_openings",
  "recruitment_candidates",
] as const

/** 外部キーの無い同じ業務内の参照。移行後も親の行を指すことを確かめる。 */
const REFERENCES = [
  ["room_reservations", "room_id", "rooms"],
  ["shift_assignments", "pattern_id", "shift_patterns"],
  ["survey_responses", "survey_id", "surveys"],
  ["thanks_redemptions", "reward_id", "thanks_rewards"],
  ["training_enrollments", "course_id", "training_courses"],
  ["recruitment_candidates", "position_id", "job_openings"],
] as const

let local: LocalD1

beforeAll(async () => {
  local = await startLocalD1({ empty: ["stage4-uuid-migration"] })
}, 120_000)

afterAll(async () => {
  await local.dispose()
})

async function ids(database: D1Database, table: string, column: string) {
  const rows = await database
    .prepare(`SELECT ${column} AS value FROM ${table} ORDER BY CAST(${column} AS TEXT)`)
    .all<{ value: string | number }>()
  return rows.results.map((row) => String(row.value))
}

async function triggerNames(database: D1Database) {
  const rows = await database
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'trigger'
       AND tbl_name IN (${TABLES.map((table) => `'${table}'`).join(",")}) ORDER BY name`,
    )
    .all<{ name: string }>()
  return rows.results.map((row) => row.name)
}

test("seed 済みのローカルD1で全行を UUID に移し、旧主キーを legacy_id に残す", async () => {
  const database = await local.database("stage4-uuid-migration")
  await migrateLocalD1Before(database, TARGET)
  await seedLocalD1(database)
  const before = Object.fromEntries(
    await Promise.all(
      TABLES.map(async (table) => [table, await ids(database, table, "id")] as const),
    ),
  )
  const triggersBefore = await triggerNames(database)

  await applyLocalD1Migration(database, TARGET)

  let migratedRows = 0
  for (const table of TABLES) {
    expect({ table, legacy: await ids(database, table, "legacy_id") }).toEqual({
      table,
      legacy: before[table] ?? [],
    })
    const invalid = await database
      .prepare(`SELECT count(*) AS count FROM ${table} WHERE NOT (${uuidCheckPredicate("id")})`)
      .first<{ count: number }>()
    expect({ table, invalid: invalid?.count }).toEqual({ table, invalid: 0 })
    migratedRows += before[table]?.length ?? 0
  }
  expect(migratedRows).toBeGreaterThan(10)
  expect(await triggerNames(database)).toEqual(
    [
      ...triggersBefore,
      ...TABLES.flatMap((table) => [`${table}_identity_update`, `${table}_legacy_id_insert`]),
    ].toSorted(),
  )
  expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
  await expect(
    database.prepare("INSERT INTO rooms (id, name, capacity) VALUES (100, 'x', 1)").run(),
  ).rejects.toThrow("CHECK constraint failed")
}, 300_000)
