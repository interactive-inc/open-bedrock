import type { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  applyMigration,
  databaseBefore,
  insertBypassingGuards,
  isUuid,
} from "../api/support/uuid-cutover-migration"

const TARGET = "0335_convert_ringi_license_leave_keys_to_uuid.sql"
// System の job の ID は UUID ではない形を含む。値を変えずに残す。
const JOB = "leave-decision:audit"
const ASSIGNMENT = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
const REQUEST_KEY = "5e0f7c3a-1d2b-4c5d-8e6f-000000000001"

function seed(database: Database) {
  database.run("PRAGMA foreign_keys = OFF")
  insertBypassingGuards(
    database,
    "leave_requests",
    `INSERT INTO leave_requests (id, employee_id, leave_type, start_date, end_date, days, status, created_at, previous_leave_request_id) VALUES
       (1, 'E005', 'annual', '2026-06-01', '2026-06-01', 1, 'returned', '2026-05-01', NULL),
       (2, 'E005', 'annual', '2026-06-01', '2026-06-01', 1, 'pending', '2026-05-02', 1)`,
  )
  insertBypassingGuards(
    database,
    "leave_procedure_bindings",
    `INSERT INTO leave_procedure_bindings (request_key, leave_request_id, previous_leave_request_id, application_id, series_id, case_id, proposal_digest, created_at)
     VALUES ('${REQUEST_KEY}', 2, 1, 7, 'series', 'case', '${"a".repeat(64)}', 0)`,
  )
  insertBypassingGuards(
    database,
    "leave_decision_notifications",
    `INSERT INTO leave_decision_notifications (job_id, leave_request_id, decision_audit_id, payload_json)
     VALUES ('${JOB}', 2, 'audit', '{"decisionAuditId":"audit","leaveRequestId":2}')`,
  )
  insertBypassingGuards(
    database,
    "leave_balances",
    `INSERT INTO leave_balances (employee_id, fiscal_year, leave_type, granted_days, used_days, remaining_days)
     VALUES ('E005', '2026', 'annual', 20, 1, 19)`,
  )
  insertBypassingGuards(
    database,
    "software_licenses",
    `INSERT INTO software_licenses (id, name, seats, status, created_at) VALUES (4, 'Tool', 5, 'active', '2026-01-01')`,
  )
  insertBypassingGuards(
    database,
    "software_license_assignments",
    `INSERT INTO software_license_assignments (id, license_id, employee_id, service_name, assigned_at, assigned_by, assigned_reason)
     VALUES ('${ASSIGNMENT}', 4, 'E005', 'svc', 0, 'account', 'onboarding')`,
  )
  insertBypassingGuards(
    database,
    "ringi_requests",
    `INSERT INTO ringi_requests (id, applicant_id, approver_id, title, amount, reason, status, created_at)
     VALUES (6, 'E005', 'E004', 'CI', 1000, 'speed', 'pending', '2026-05-01')`,
  )
}

function idOf(database: Database, table: string, legacyId: string): string {
  return (
    database
      .query<{ id: string }, [string]>(`SELECT id FROM ${table} WHERE legacy_id = ?1`)
      .get(legacyId)?.id ?? ""
  )
}

test("休暇・ライセンス・稟議の主キーを UUID にし、結び付けと通知と割当の参照を追従させる", () => {
  const database = databaseBefore(TARGET)
  try {
    seed(database)
    const violationsBefore = database.query("PRAGMA foreign_key_check").all().length

    applyMigration(database, TARGET)

    const first = idOf(database, "leave_requests", "1")
    const second = idOf(database, "leave_requests", "2")
    expect([first, second].every(isUuid)).toBe(true)
    expect(
      database
        .query("SELECT previous_leave_request_id FROM leave_requests WHERE id = ?1")
        .get(second),
    ).toEqual({ previous_leave_request_id: first })
    const binding = database
      .query<
        {
          id: string
          request_key: string
          leave_request_id: string
          previous_leave_request_id: string
        },
        []
      >(
        "SELECT id, request_key, leave_request_id, previous_leave_request_id FROM leave_procedure_bindings",
      )
      .get()
    expect(isUuid(binding?.id)).toBe(true)
    expect(binding).toMatchObject({
      request_key: REQUEST_KEY,
      leave_request_id: second,
      previous_leave_request_id: first,
    })
    expect(
      database
        .query("SELECT job_id, leave_request_id, payload_json FROM leave_decision_notifications")
        .get(),
    ).toEqual({
      job_id: JOB,
      leave_request_id: second,
      payload_json: JSON.stringify({ decisionAuditId: "audit", leaveRequestId: second }),
    })
    expect(() =>
      database.run("UPDATE leave_decision_notifications SET decision_audit_id = 'x'"),
    ).toThrow("immutable")
    expect(
      isUuid(database.query<{ id: string }, []>("SELECT id FROM leave_balances").get()?.id),
    ).toBe(true)
    expect(database.query("SELECT id, license_id FROM software_license_assignments").get()).toEqual(
      {
        id: ASSIGNMENT,
        license_id: idOf(database, "software_licenses", "4"),
      },
    )
    expect(isUuid(idOf(database, "ringi_requests", "6"))).toBe(true)
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
       VALUES ('${crypto.randomUUID()}', 'ns', 'leave', 1, '${crypto.randomUUID()}', '{}')`,
    )

    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
  } finally {
    database.close()
  }
})
