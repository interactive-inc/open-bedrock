import type { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  applyMigration,
  databaseBefore,
  dependentObjects,
  insertBypassingGuards,
  isUuid,
} from "../api/support/uuid-cutover-migration"

const TARGET = "0331_convert_business_uuid_primary_keys_stage4.sql"

/** 整数の主キーから UUID へ移す table。room_reservations は主キーが既に UUID なので含めない。 */
const INTEGER_TABLES = [
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

const RESERVATION = "3f0c8c1e-6d2a-4b7e-9a51-0c2d4e6f8a10"

function seed(database: Database) {
  database.run("PRAGMA foreign_keys = OFF")
  database.run(
    `INSERT INTO rooms (id, name, capacity, location) VALUES (2, 'B', 10, NULL), (5, 'A', 20, NULL)`,
  )
  database.run(
    `INSERT INTO room_reservations (id, room_id, reserver_id, start_at, end_at) VALUES
       ('${RESERVATION}', 5, 'E001', '2026-01-01T09:00:00Z', '2026-01-01T10:00:00Z')`,
  )
  database.run(
    `INSERT INTO shift_patterns (id, code, name, start_time, end_time, break_minutes) VALUES
       (1, 'EARLY', 'early', '07:00', '16:00', 60)`,
  )
  database.run(
    `INSERT INTO shift_assignments (id, employee_id, pattern_id, date) VALUES
       (1, 'E001', 1, '2026-06-01'), (2, 'E001', NULL, '2026-06-02')`,
  )
}

test("主キーを UUID にし、会議室予約と勤務割当の参照を追従させ、作成日時を足す", () => {
  const database = databaseBefore(TARGET)
  try {
    seed(database)
    const violationsBefore = database.query("PRAGMA foreign_key_check").all().length
    const before = Object.fromEntries(
      [...INTEGER_TABLES, "room_reservations"].map((table) => [
        table,
        dependentObjects(database, table),
      ]),
    )

    applyMigration(database, TARGET)

    const rooms = new Map(
      database
        .query<{ id: string; legacy_id: string; created_at: string }, []>(
          "SELECT id, legacy_id, created_at FROM rooms",
        )
        .all()
        .map((row) => [row.legacy_id, row]),
    )
    expect([...rooms.values()].every((row) => isUuid(row.id))).toBe(true)
    expect([...rooms.values()].every((row) => !Number.isNaN(Date.parse(row.created_at)))).toBe(true)
    expect(database.query("SELECT id, room_id FROM room_reservations").all()).toEqual([
      { id: RESERVATION, room_id: rooms.get("5")?.id ?? "" },
    ])
    const pattern = database
      .query<{ id: string }, []>("SELECT id FROM shift_patterns WHERE legacy_id = '1'")
      .get()
    expect(
      database
        .query("SELECT legacy_id, pattern_id FROM shift_assignments ORDER BY legacy_id")
        .all(),
    ).toEqual([
      { legacy_id: "1", pattern_id: pattern?.id ?? "" },
      { legacy_id: "2", pattern_id: null },
    ])

    for (const table of INTEGER_TABLES) {
      expect(
        dependentObjects(database, table)
          .map((object) => object.name)
          .toSorted(),
      ).toEqual(
        [
          ...(before[table] ?? []).map((object) => object.name),
          `${table}_identity_update`,
          `${table}_legacy_id_insert`,
        ].toSorted(),
      )
    }
    expect(dependentObjects(database, "room_reservations")).toEqual(
      before["room_reservations"] ?? [],
    )
    expect(database.query("PRAGMA foreign_key_check").all()).toHaveLength(violationsBefore)
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

test("撤去の停止中の業務があれば止める", () => {
  const database = databaseBefore(TARGET)
  try {
    insertBypassingGuards(
      database,
      "system_record_source_freezes",
      `INSERT INTO system_record_source_freezes (id, source_namespace, owner_context, revision, created_audit_event_id, snapshot_json)
       VALUES ('${crypto.randomUUID()}', 'ns', 'thanks', 1, '${crypto.randomUUID()}', '{}')`,
    )

    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
  } finally {
    database.close()
  }
})
