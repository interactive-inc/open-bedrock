import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { shiftSnapshotQuery } from "@/contexts/shift/infrastructure/adapters/lib/shift-snapshot-query"
import type { ShiftRecordKind } from "@/contexts/shift/domain/definitions/shift-record-kind.definition"

test("勤務パターン・割当・交代申請の原記録に全列を残す", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE shift_patterns (
      id INTEGER PRIMARY KEY, code TEXT, name TEXT, start_time TEXT, end_time TEXT,
      break_minutes INTEGER
    );
    CREATE TABLE shift_assignments (
      id INTEGER PRIMARY KEY, employee_id TEXT, pattern_id INTEGER, date TEXT,
      note TEXT, published_at TEXT
    );
    CREATE TABLE shift_swap_requests (
      id INTEGER PRIMARY KEY, requester_employee_id TEXT, target_employee_id TEXT,
      date TEXT, note TEXT, status TEXT, approved_at TEXT
    );
    INSERT INTO shift_patterns VALUES (1,'day','Day','09:00','18:00',60);
    INSERT INTO shift_assignments VALUES (
      2,'employee-1',1,'2026-09-15','Front desk','2026-09-01T12:00:00.000Z'
    );
    INSERT INTO shift_swap_requests VALUES (
      3,'employee-1','employee-2','2026-09-15','Trade','approved',
      '2026-09-10T12:00:00.000Z'
    );
  `)
  const sources: ReadonlyArray<readonly [ShiftRecordKind, string]> = [
    ["shift-pattern-record", "1"],
    ["shift-assignment-record", "2"],
    ["shift-swap-request-record", "3"],
  ]
  const snapshots = sources.map(([kind, id]) => {
    const query = shiftSnapshotQuery(kind, id)
    if (query instanceof Error) throw query
    const row = database.query(query.sql).get(...query.values) as { snapshot_json: string } | null
    if (row === null) throw new Error(`missing ${kind}`)
    return JSON.parse(row.snapshot_json)
  })
  expect(snapshots[0].pattern).toMatchObject({
    id: 1,
    code: "day",
    name: "Day",
    start_time: "09:00",
    end_time: "18:00",
    break_minutes: 60,
  })
  expect(snapshots[1].assignment).toMatchObject({
    id: 2,
    employee_id: "employee-1",
    pattern_id: 1,
    date: "2026-09-15",
    note: "Front desk",
    published_at: "2026-09-01T12:00:00.000Z",
  })
  expect(snapshots[2].swapRequest).toMatchObject({
    id: 3,
    requester_employee_id: "employee-1",
    target_employee_id: "employee-2",
    date: "2026-09-15",
    note: "Trade",
    status: "approved",
    approved_at: "2026-09-10T12:00:00.000Z",
  })
  expect(shiftSnapshotQuery("shift-pattern-record", "01")).toBeInstanceOf(Error)
  database.close()
})
