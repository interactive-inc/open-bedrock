import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { meetingSnapshotQuery } from "@/contexts/meeting/infrastructure/adapters/lib/meeting-snapshot-query"
import type { MeetingRecordKind } from "@/contexts/meeting/domain/definitions/meeting-record-kind.definition"

test("会議体・議事録・意思決定の原記録に全列を残す", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE meetings (
      id TEXT PRIMARY KEY, legacy_id TEXT, code TEXT, name TEXT, cadence TEXT, description TEXT,
      status TEXT, created_at TEXT
    );
    CREATE TABLE meeting_minutes_records (
      id TEXT PRIMARY KEY, legacy_id TEXT, meeting_id TEXT, held_on TEXT, title TEXT, attendees TEXT,
      body_md TEXT, author_employee_id TEXT, created_at TEXT
    );
    CREATE TABLE decision_records (
      id TEXT PRIMARY KEY, legacy_id TEXT, title TEXT, decided_on TEXT, context TEXT, decision TEXT,
      consequences TEXT, status TEXT, superseded_by_id TEXT, created_at TEXT
    );
    INSERT INTO meetings VALUES (
      '0190001b-0000-7000-8000-000000000001','1','directors','Board','monthly','Governance','active','2026-09-01T00:00:00.000Z'
    );
    INSERT INTO meeting_minutes_records VALUES (
      '0190001c-0000-7000-8000-000000000002','2','0190001b-0000-7000-8000-000000000001','2026-09-15','September','Alice, Bob','# Minutes','employee-uuid',
      '2026-09-15T12:00:00.000Z'
    );
    INSERT INTO decision_records VALUES (
      '0190001a-0000-7000-8000-000000000003',NULL,'New policy','2026-09-15','Budget','Approve plan','Record action','current',NULL,
      '2026-09-15T13:00:00.000Z'
    );
  `)
  const sources: ReadonlyArray<readonly [MeetingRecordKind, string]> = [
    ["meeting-record", "0190001b-0000-7000-8000-000000000001"],
    ["meeting-minutes-record", "0190001c-0000-7000-8000-000000000002"],
    ["meeting-decision-record", "0190001a-0000-7000-8000-000000000003"],
  ]
  const snapshots = sources.map(([kind, id]) => {
    const query = meetingSnapshotQuery(kind, id)
    if (query instanceof Error) throw query
    const row = database.query(query.sql).get(...query.values) as { snapshot_json: string } | null
    if (row === null) throw new Error(`missing ${kind}`)
    return JSON.parse(row.snapshot_json)
  })
  expect(snapshots[0].meeting).toMatchObject({
    id: "0190001b-0000-7000-8000-000000000001",
    legacy_id: "1",
    code: "directors",
    cadence: "monthly",
    description: "Governance",
    status: "active",
  })
  expect(snapshots[1].minutes).toMatchObject({
    id: "0190001c-0000-7000-8000-000000000002",
    legacy_id: "2",
    meeting_id: "0190001b-0000-7000-8000-000000000001",
    attendees: "Alice, Bob",
    body_md: "# Minutes",
    author_employee_id: "employee-uuid",
  })
  expect(snapshots[2].decision).toMatchObject({
    id: "0190001a-0000-7000-8000-000000000003",
    legacy_id: null,
    context: "Budget",
    decision: "Approve plan",
    consequences: "Record action",
    status: "current",
    superseded_by_id: null,
  })
  expect(meetingSnapshotQuery("meeting-record", "1")).toBeInstanceOf(Error)
  database.close()
})
