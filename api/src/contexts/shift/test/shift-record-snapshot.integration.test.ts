import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { shiftSnapshotQuery } from "@/contexts/shift/infrastructure/adapters/lib/shift-snapshot-query"
import type { ShiftRecordKind } from "@/contexts/shift/domain/definitions/shift-record-kind.definition"

const PATTERN_ID = "01900023-0000-7000-8000-000000000001"
const ASSIGNMENT_ID = "01900024-0000-7000-8000-000000000002"
const SWAP_ID = "01900025-0000-7000-8000-000000000003"
const CREATED_AT = "2026-01-01T00:00:00.000Z"

test("勤務パターン・割当・交代申請の原記録に全列を残す", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE shift_patterns (
      id TEXT PRIMARY KEY, code TEXT, name TEXT, start_time TEXT, end_time TEXT,
      break_minutes INTEGER, created_at TEXT, legacy_id TEXT
    );
    CREATE TABLE shift_assignments (
      id TEXT PRIMARY KEY, employee_id TEXT, pattern_id TEXT, date TEXT,
      note TEXT, published_at TEXT, created_at TEXT, legacy_id TEXT
    );
    CREATE TABLE shift_swap_requests (
      id TEXT PRIMARY KEY, requester_employee_id TEXT, target_employee_id TEXT,
      date TEXT, note TEXT, status TEXT, approved_at TEXT, created_at TEXT, legacy_id TEXT
    );
    INSERT INTO shift_patterns VALUES ('${PATTERN_ID}','day','Day','09:00','18:00',60,'${CREATED_AT}','1');
    INSERT INTO shift_assignments VALUES (
      '${ASSIGNMENT_ID}','employee-1','${PATTERN_ID}','2026-09-15','Front desk',
      '2026-09-01T12:00:00.000Z','${CREATED_AT}','2'
    );
    INSERT INTO shift_swap_requests VALUES (
      '${SWAP_ID}','employee-1','employee-2','2026-09-15','Trade','approved',
      '2026-09-10T12:00:00.000Z','${CREATED_AT}',NULL
    );
  `)
  const sources: ReadonlyArray<readonly [ShiftRecordKind, string]> = [
    ["shift-pattern-record", PATTERN_ID],
    ["shift-assignment-record", ASSIGNMENT_ID],
    ["shift-swap-request-record", SWAP_ID],
  ]
  const snapshots = sources.map(([kind, id]) => {
    const query = shiftSnapshotQuery(kind, id)
    if (query instanceof Error) throw query
    const row = database.query(query.sql).get(...query.values) as { snapshot_json: string } | null
    if (row === null) throw new Error(`missing ${kind}`)
    return JSON.parse(row.snapshot_json)
  })
  expect(snapshots.map((snapshot) => snapshot.version)).toEqual([2, 2, 2])
  expect(snapshots[0].pattern).toEqual({
    id: PATTERN_ID,
    legacy_id: "1",
    code: "day",
    name: "Day",
    start_time: "09:00",
    end_time: "18:00",
    break_minutes: 60,
    created_at: CREATED_AT,
  })
  expect(snapshots[1].assignment).toEqual({
    id: ASSIGNMENT_ID,
    legacy_id: "2",
    employee_id: "employee-1",
    pattern_id: PATTERN_ID,
    date: "2026-09-15",
    note: "Front desk",
    published_at: "2026-09-01T12:00:00.000Z",
    created_at: CREATED_AT,
  })
  expect(snapshots[2].swapRequest).toEqual({
    id: SWAP_ID,
    legacy_id: null,
    requester_employee_id: "employee-1",
    target_employee_id: "employee-2",
    date: "2026-09-15",
    note: "Trade",
    status: "approved",
    approved_at: "2026-09-10T12:00:00.000Z",
    created_at: CREATED_AT,
  })
  expect(shiftSnapshotQuery("shift-pattern-record", "1")).toBeInstanceOf(Error)
  database.close()
})
