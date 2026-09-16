import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  decodeLeaveBalanceRecordId,
  encodeLeaveBalanceRecordId,
  type LeaveRecordKind,
} from "@/contexts/leave/domain/definitions/leave-record-kind.definition"
import { leaveSnapshotQuery } from "@/contexts/leave/infrastructure/adapters/lib/leave-snapshot-query"

test("休暇4台帳の原記録は業務を外した後も再現できる項目を保持する", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE leave_requests (
      id INTEGER PRIMARY KEY, employee_id INTEGER, leave_type TEXT, start_date TEXT, end_date TEXT,
      days INTEGER, reason TEXT, status TEXT, approver_id INTEGER, decided_comment TEXT,
      created_at TEXT, unit TEXT, hours REAL, consumed_days REAL, previous_leave_request_id INTEGER
    );
    CREATE TABLE leave_balances (
      employee_id INTEGER, fiscal_year TEXT, leave_type TEXT, granted_days REAL, used_days REAL,
      remaining_days REAL, PRIMARY KEY (employee_id, fiscal_year, leave_type)
    );
    CREATE TABLE leave_procedure_bindings (
      request_key TEXT PRIMARY KEY, leave_request_id INTEGER, previous_leave_request_id INTEGER,
      application_id INTEGER, series_id TEXT, case_id TEXT, proposal_digest TEXT, created_at INTEGER
    );
    CREATE TABLE leave_decision_notifications (
      job_id TEXT PRIMARY KEY, leave_request_id INTEGER, decision_audit_id TEXT, payload_json TEXT
    );
    INSERT INTO leave_requests VALUES (
      7, 12, 'annual', '2026-10-01', '2026-10-02', 2, 'family', 'approved', 8,
      'accepted', '2026-09-01T00:00:00.000Z', 'full_day', NULL, 2, NULL
    );
    INSERT INTO leave_balances VALUES (12, '2026', 'annual:special', 20, 2, 18);
    INSERT INTO leave_procedure_bindings VALUES (
      'leave:req:7', 7, NULL, 42, 'series-7', 'case-7', '${"a".repeat(64)}', 1780000000000
    );
    INSERT INTO leave_decision_notifications VALUES (
      'job-7', 7, 'audit-7', '{"body": "approved", "attempt": 1}'
    );
  `)
  const balanceId = encodeLeaveBalanceRecordId(12, "2026", "annual:special")
  expect(balanceId).toBe("12:2026:annual%3Aspecial")
  expect(decodeLeaveBalanceRecordId(balanceId)).toEqual({
    employeeId: "12",
    fiscalYear: "2026",
    leaveType: "annual:special",
  })
  for (const malformed of ["12:2026:annual:special", ":2026:annual", "12:2026:%ZZ"]) {
    expect(decodeLeaveBalanceRecordId(malformed)).toBeNull()
  }
  const sources: ReadonlyArray<readonly [LeaveRecordKind, string]> = [
    ["leave-request-record", "7"],
    ["leave-balance-record", balanceId],
    ["leave-procedure-binding-record", "leave:req:7"],
    ["leave-decision-notification-record", "job-7"],
  ]
  const snapshots = sources.map(([kind, id]) => {
    const query = leaveSnapshotQuery(kind, id)
    if (query instanceof Error) throw query
    const row = database.query(query.sql).get(...query.values) as { snapshot_json: string } | null
    if (row === null) throw new Error(`missing ${kind}`)
    return JSON.parse(row.snapshot_json)
  })
  expect(snapshots[0].request).toMatchObject({
    id: 7,
    employee_id: 12,
    status: "approved",
    decided_comment: "accepted",
    consumed_days: 2,
  })
  expect(snapshots[1].balance).toMatchObject({
    employee_id: 12,
    fiscal_year: "2026",
    leave_type: "annual:special",
    remaining_days: 18,
  })
  expect(snapshots[2].binding).toMatchObject({
    request_key: "leave:req:7",
    application_id: 42,
    case_id: "case-7",
    proposal_digest: "a".repeat(64),
  })
  expect(snapshots[3].notification).toMatchObject({
    job_id: "job-7",
    decision_audit_id: "audit-7",
    payload_json: '{"body": "approved", "attempt": 1}',
  })
  expect(leaveSnapshotQuery("leave-request-record", "07")).toBeInstanceOf(Error)
  expect(leaveSnapshotQuery("leave-balance-record", "12:2026:annual:special")).toBeInstanceOf(Error)
  database.close()
})
