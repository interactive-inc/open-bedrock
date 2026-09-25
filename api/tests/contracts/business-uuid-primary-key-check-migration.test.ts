import type { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  applyMigration,
  databaseBefore,
  dependentObjects,
  insertBypassingGuards,
  isUuid,
} from "../api/support/uuid-cutover-migration"

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
] as const

const VALID = "3f0c8c1e-6d2a-4b7e-9a51-0c2d4e6f8a10"
const VALID_STOCKTAKE = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
// 旧 seed の version 0 の疑似 UUID。形は UUID だが RFC 9562 の version と variant を持たない。
const LEGACY_STOCKTAKE = "00000000-0000-0000-0000-000000000002"

function seed(database: Database) {
  database.run("PRAGMA foreign_keys = OFF")
  database.run(
    `INSERT INTO antisocial_checks (id, requester_id, partner_name, status, created_at)
     VALUES ('${VALID}', 'E001', 'partner', 'requested', '2026-01-01T00:00:00Z')`,
  )
  database.run(
    `INSERT INTO room_reservations (id, room_id, reserver_id, start_at, end_at)
     VALUES ('${VALID}', 1, 'E001', '2026-01-01T09:00:00Z', '2026-01-01T10:00:00Z'),
            ('00000000-0000-0000-0000-000000000001', 1, 'E001', '2026-01-02T09:00:00Z', '2026-01-02T10:00:00Z')`,
  )
  database.run(
    `INSERT INTO stocktakes (id, name, target_date, status, created_at)
     VALUES ('${VALID_STOCKTAKE}', 'current', '2026-01-01', 'open', '2026-01-01T00:00:00Z'),
            ('${LEGACY_STOCKTAKE}', 'legacy', '2025-01-01', 'closed', '2025-01-01T00:00:00Z')`,
  )
  database.run(
    `INSERT INTO stocktake_items (stocktake_id, asset_code) VALUES
       ('${VALID_STOCKTAKE}', 'A001'), ('${LEGACY_STOCKTAKE}', 'A001'), ('${LEGACY_STOCKTAKE}', 'A002')`,
  )
}

test("UUID の主キーは保持し、UUID でない主キーだけを置き換えて参照を追従させる", () => {
  const database = databaseBefore(TARGET)
  try {
    seed(database)
    const before = Object.fromEntries(
      TABLES.map((table) => [table, dependentObjects(database, table)]),
    )

    applyMigration(database, TARGET)

    expect(database.query("SELECT id FROM antisocial_checks").all()).toEqual([{ id: VALID }])
    const reservations = database
      .query<{ id: string; start_at: string }, []>(
        "SELECT id, start_at FROM room_reservations ORDER BY start_at",
      )
      .all()
    expect(reservations).toHaveLength(2)
    expect(reservations[0]?.id).toBe(VALID)
    expect(isUuid(reservations[1]?.id)).toBe(true)

    const stocktakes = database
      .query<{ id: string; name: string }, []>("SELECT id, name FROM stocktakes ORDER BY name")
      .all()
    const migratedLegacy = stocktakes.find((row) => row.name === "legacy")?.id
    expect(stocktakes.find((row) => row.name === "current")?.id).toBe(VALID_STOCKTAKE)
    expect(isUuid(migratedLegacy)).toBe(true)
    expect(
      database
        .query(
          "SELECT stocktake_id, asset_code FROM stocktake_items ORDER BY asset_code, stocktake_id",
        )
        .all(),
    ).toEqual(
      [
        { stocktake_id: VALID_STOCKTAKE, asset_code: "A001" },
        { stocktake_id: migratedLegacy, asset_code: "A001" },
        { stocktake_id: migratedLegacy, asset_code: "A002" },
      ].toSorted((left, right) =>
        `${left.asset_code}${left.stocktake_id}`.localeCompare(
          `${right.asset_code}${right.stocktake_id}`,
        ),
      ),
    )

    for (const table of TABLES) {
      expect(dependentObjects(database, table)).toEqual(before[table] ?? [])
    }
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

test("移行後は UUID でない主キーを保存できない", () => {
  const database = databaseBefore(TARGET)
  try {
    applyMigration(database, TARGET)
    database.run("PRAGMA foreign_keys = OFF")
    for (const id of [
      "not-a-uuid",
      "00000000-0000-0000-0000-000000000000",
      "3F0C8C1E-6D2A-4B7E-9A51-0C2D4E6F8A10",
    ]) {
      expect(() =>
        database.run(
          `INSERT INTO life_events (id, employee_id, event_type, event_date, status, created_at)
           VALUES ('${id}', 'E001', 'marriage', '2026-01-01', 'requested', '2026-01-01T00:00:00Z')`,
        ),
      ).toThrow("CHECK constraint failed")
    }
    database.run(
      `INSERT INTO life_events (id, employee_id, event_type, event_date, status, created_at)
       VALUES ('${crypto.randomUUID()}', 'E001', 'marriage', '2026-01-01', 'requested', '2026-01-01T00:00:00Z')`,
    )
  } finally {
    database.close()
  }
})

test("撤去の停止中の業務があれば止める", () => {
  const database = databaseBefore(TARGET)
  try {
    insertBypassingGuards(
      database,
      "system_record_source_freezes",
      `INSERT INTO system_record_source_freezes (id, source_namespace, owner_context, revision, created_audit_event_id, snapshot_json)
       VALUES ('${crypto.randomUUID()}', 'ns', 'rental', 1, '${crypto.randomUUID()}', '{}')`,
    )

    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
  } finally {
    database.close()
  }
})

test("置き換える主キーが変更不能な証跡に現れれば止める", () => {
  const database = databaseBefore(TARGET)
  try {
    seed(database)
    insertBypassingGuards(
      database,
      "system_record_coverage_entries",
      `INSERT INTO system_record_coverage_entries (page_id, freeze_id, record_kind, source_record_id, preserved_record_id)
       VALUES ('${crypto.randomUUID()}', '${crypto.randomUUID()}', 'stocktake', '${LEGACY_STOCKTAKE}', '${crypto.randomUUID()}')`,
    )

    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
  } finally {
    database.close()
  }
})
