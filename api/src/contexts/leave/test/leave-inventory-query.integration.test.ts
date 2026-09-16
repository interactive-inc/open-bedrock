import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { leaveInventoryQuery } from "@/contexts/leave/infrastructure/adapters/lib/leave-inventory-query"
import type { LeaveRecordKind } from "@/contexts/leave/domain/definitions/leave-record-kind.definition"

test("休暇4台帳を複合キーを含む主キー順で分割し、欠落と重複を作らない", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE leave_requests (id INTEGER PRIMARY KEY);
    CREATE TABLE leave_balances (
      employee_id TEXT, fiscal_year TEXT, leave_type TEXT,
      PRIMARY KEY (employee_id, fiscal_year, leave_type)
    );
    CREATE TABLE leave_procedure_bindings (request_key TEXT PRIMARY KEY);
    CREATE TABLE leave_decision_notifications (job_id TEXT PRIMARY KEY);
  `)
  for (let index = 1; index <= 11; index++) {
    database.query("INSERT INTO leave_requests VALUES (?1)").run(index)
    database
      .query("INSERT INTO leave_balances VALUES (?1,?2,?3)")
      .run("employee-uuid", String(2025 + index), "annual:special")
  }
  database.exec(`
    INSERT INTO leave_procedure_bindings VALUES ('binding-a'),('binding-b');
    INSERT INTO leave_decision_notifications VALUES ('job-a'),('job-b');
  `)
  const scan = (recordKind: LeaveRecordKind) => {
    let cursor: string | null = null
    const pages: string[][] = []
    do {
      const query = leaveInventoryQuery(recordKind, cursor, 10)
      if (query instanceof Error) throw query
      const rows = database.query(query.sql).all(...query.values) as Record<string, unknown>[]
      const ids = rows.map(query.recordId)
      const page = ids.slice(0, 10)
      pages.push(page)
      cursor = ids.length > 10 ? (page.at(-1) ?? null) : null
    } while (cursor !== null)
    return pages
  }
  expect(scan("leave-request-record")).toEqual([
    Array.from({ length: 10 }, (_, index) => String(index + 1)),
    ["11"],
  ])
  expect(scan("leave-balance-record")).toEqual([
    Array.from({ length: 10 }, (_, index) => `employee-uuid:${2026 + index}:annual%3Aspecial`),
    ["employee-uuid:2036:annual%3Aspecial"],
  ])
  expect(scan("leave-procedure-binding-record")).toEqual([["binding-a", "binding-b"]])
  expect(scan("leave-decision-notification-record")).toEqual([["job-a", "job-b"]])
  expect(leaveInventoryQuery("leave-request-record", "01", 10)).toBeInstanceOf(Error)
  expect(leaveInventoryQuery("leave-balance-record", "broken", 10)).toBeInstanceOf(Error)
  database.close()
})
