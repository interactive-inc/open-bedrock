import type { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  applyMigration,
  databaseBefore,
  insertBypassingGuards,
  isUuid,
} from "../api/support/uuid-cutover-migration"

const TARGET = "0336_convert_expense_keys_to_uuid.sql"
const REQUEST_KEY = "5e0f7c3a-1d2b-4c5d-8e6f-000000000001"
const ATTACHMENT = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"

function seed(database: Database) {
  insertBypassingGuards(
    database,
    "expenses",
    `INSERT INTO expenses (id, employee_id, organization_unit_id, category, amount, spent_at, status, created_at) VALUES
       (1, 'E005', 'department:D003', 'transport', 1200, '2026-05-10', 'returned', '2026-05-11'),
       (2, 'E005', 'department:D003', 'transport', 1200, '2026-05-10', 'pending', '2026-05-12')`,
  )
  insertBypassingGuards(
    database,
    "expense_approvals",
    `INSERT INTO expense_approvals (id, expense_id, approver_id, action, created_at) VALUES (3, 1, 'E004', 'return', '2026-05-11')`,
  )
  insertBypassingGuards(
    database,
    "expense_attachments",
    `INSERT INTO expense_attachments (expense_id, attachment_id, created_at) VALUES (2, '${ATTACHMENT}', '2026-05-12')`,
  )
  insertBypassingGuards(
    database,
    "expense_procedure_bindings",
    `INSERT INTO expense_procedure_bindings (previous_expense_id, request_key, expense_id, application_id, series_id, case_id, proposal_digest, created_at, attachment_evidence_json)
     VALUES (1, '${REQUEST_KEY}', 2, 7, 'series', 'case', '${"a".repeat(64)}', 0, '[]')`,
  )
  insertBypassingGuards(
    database,
    "expense_budgets",
    `INSERT INTO expense_budgets (id, organization_unit_id, fiscal_period, period_start, period_end, amount, name, created_at)
     VALUES (5, 'department:D003', '2026', '2026-04-01', '2027-03-31', 1000, 'budget', '2026-04-01')`,
  )
}

function idOf(database: Database, table: string, legacyId: string): string {
  return (
    database
      .query<{ id: string }, [string]>(`SELECT id FROM ${table} WHERE legacy_id = ?1`)
      .get(legacyId)?.id ?? ""
  )
}

test("経費の主キーを UUID にし、承認・添付・結び付けの参照を追従させる", () => {
  const database = databaseBefore(TARGET)
  try {
    seed(database)
    const violationsBefore = database.query("PRAGMA foreign_key_check").all().length

    applyMigration(database, TARGET)

    const returned = idOf(database, "expenses", "1")
    const pending = idOf(database, "expenses", "2")
    expect([returned, pending, idOf(database, "expense_budgets", "5")].every(isUuid)).toBe(true)
    expect(database.query("SELECT expense_id FROM expense_approvals").get()).toEqual({
      expense_id: returned,
    })
    const attachment = database
      .query<{ id: string; expense_id: string; attachment_id: string }, []>(
        "SELECT id, expense_id, attachment_id FROM expense_attachments",
      )
      .get()
    expect(isUuid(attachment?.id)).toBe(true)
    expect(attachment).toMatchObject({ expense_id: pending, attachment_id: ATTACHMENT })
    const binding = database
      .query<
        { id: string; request_key: string; expense_id: string; previous_expense_id: string },
        []
      >("SELECT id, request_key, expense_id, previous_expense_id FROM expense_procedure_bindings")
      .get()
    expect(isUuid(binding?.id)).toBe(true)
    expect(binding).toMatchObject({
      request_key: REQUEST_KEY,
      expense_id: pending,
      previous_expense_id: returned,
    })
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

test("撤去の停止中なら止める", () => {
  const database = databaseBefore(TARGET)
  try {
    insertBypassingGuards(
      database,
      "system_record_source_freezes",
      `INSERT INTO system_record_source_freezes (id, source_namespace, owner_context, revision, created_audit_event_id, snapshot_json)
       VALUES ('${crypto.randomUUID()}', 'ns', 'expense', 1, '${crypto.randomUUID()}', '{}')`,
    )

    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
  } finally {
    database.close()
  }
})
