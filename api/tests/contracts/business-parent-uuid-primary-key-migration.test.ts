import type { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  applyMigration,
  databaseBefore,
  dependentObjects,
  insertBypassingGuards,
  isUuid,
} from "../api/support/uuid-cutover-migration"

const TARGET = "0330_convert_business_parent_primary_keys_to_uuid.sql"

const TABLES = [
  "announcements",
  "asset_lendings",
  "attendance_records",
  "career_postings",
  "career_applications",
  "certification_definitions",
  "employee_certifications",
  "decision_records",
  "meetings",
  "meeting_minutes_records",
  "partners",
  "partner_contracts",
  "regulations",
  "regulation_versions",
] as const

function seed(database: Database) {
  database.run("PRAGMA foreign_keys = OFF")
  database.run(
    `INSERT INTO partners (id, code, name, status, created_at) VALUES
       (4, 'P0004', 'supplier', 'active', '2026-01-01T00:00:00Z'),
       (9, 'P0009', 'buyer', 'active', '2026-01-02T00:00:00Z')`,
  )
  database.run(
    `INSERT INTO partner_contracts (id, partner_id, title, contract_date, created_at) VALUES
       (1, 4, 'supply', '2026-01-10', '2026-01-10T00:00:00Z'),
       (2, 9, 'sales', '2026-01-11', '2026-01-11T00:00:00Z'),
       (3, 9, 'renewal', '2026-01-12', '2026-01-12T00:00:00Z'),
       (4, 77, 'orphan', '2026-01-13', '2026-01-13T00:00:00Z')`,
  )
  database.run(
    `INSERT INTO decision_records (id, title, decided_on, context, decision, status, superseded_by_id, created_at) VALUES
       (1, 'old', '2025-01-01', 'c', 'd', 'superseded', 2, '2025-01-01T00:00:00Z'),
       (2, 'new', '2026-01-01', 'c', 'd', 'active', NULL, '2026-01-01T00:00:00Z')`,
  )
}

test("親と子の主キーを UUID にし、外部キーの無い参照を新しい主キーへ追従させる", () => {
  const database = databaseBefore(TARGET)
  try {
    seed(database)
    const violationsBefore = database.query("PRAGMA foreign_key_check").all().length
    const before = Object.fromEntries(
      TABLES.map((table) => [table, dependentObjects(database, table)]),
    )

    applyMigration(database, TARGET)

    const partners = new Map(
      database
        .query<{ id: string; legacy_id: string }, []>("SELECT id, legacy_id FROM partners")
        .all()
        .map((row) => [row.legacy_id, row.id]),
    )
    expect([...partners.values()].every(isUuid)).toBe(true)
    expect(
      database
        .query<{ legacy_id: string; partner_id: string }, []>(
          "SELECT legacy_id, partner_id FROM partner_contracts ORDER BY CAST(legacy_id AS INTEGER)",
        )
        .all(),
    ).toEqual([
      { legacy_id: "1", partner_id: partners.get("4") ?? "" },
      { legacy_id: "2", partner_id: partners.get("9") ?? "" },
      { legacy_id: "3", partner_id: partners.get("9") ?? "" },
      // 移行前から取引先を持たない契約は旧 ID の文字列を残し、別の取引先を指させない。
      { legacy_id: "4", partner_id: "77" },
    ])
    const decisions = new Map(
      database
        .query<{ id: string; legacy_id: string; superseded_by_id: string | null }, []>(
          "SELECT id, legacy_id, superseded_by_id FROM decision_records",
        )
        .all()
        .map((row) => [row.legacy_id, row]),
    )
    expect(decisions.get("1")?.superseded_by_id).toBe(decisions.get("2")?.id ?? "")
    expect(decisions.get("2")?.superseded_by_id).toBeNull()

    for (const table of TABLES) {
      const names = dependentObjects(database, table).map((object) => object.name)
      expect(names.toSorted()).toEqual(
        [
          ...(before[table] ?? []).map((object) => object.name),
          `${table}_identity_update`,
          `${table}_legacy_id_insert`,
        ].toSorted(),
      )
    }
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
       VALUES ('${crypto.randomUUID()}', 'ns', 'regulation', 1, '${crypto.randomUUID()}', '{}')`,
    )

    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
  } finally {
    database.close()
  }
})
