import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { roomSnapshotQuery } from "@/contexts/room/infrastructure/adapters/lib/room-snapshot-query"
import type { RoomRecordKind } from "@/contexts/room/domain/definitions/room-record-kind.definition"

const ROOM_ID = "01900022-0000-7000-8000-000000000001"

test("会議室と予約の全列を原記録に残す", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE rooms (
      id TEXT PRIMARY KEY, name TEXT, capacity INTEGER, location TEXT,
      created_at TEXT, legacy_id TEXT
    );
    CREATE TABLE room_reservations (
      id TEXT PRIMARY KEY, room_id TEXT, reserver_id TEXT, start_at TEXT,
      end_at TEXT, purpose TEXT
    );
    INSERT INTO rooms VALUES ('${ROOM_ID}','Conference A',8,'Floor 2','2026-01-01T00:00:00.000Z','1');
    INSERT INTO room_reservations VALUES (
      '5e0f7c3a-1d2b-4c5d-8e6f-000000000002','${ROOM_ID}','employee-1','2026-09-15T09:00:00.000Z',
      '2026-09-15T10:00:00.000Z','Planning'
    );
  `)
  const sources: ReadonlyArray<readonly [RoomRecordKind, string]> = [
    ["room-record", ROOM_ID],
    ["room-reservation-record", "5e0f7c3a-1d2b-4c5d-8e6f-000000000002"],
  ]
  const snapshots = sources.map(([kind, id]) => {
    const query = roomSnapshotQuery(kind, id)
    if (query instanceof Error) throw query
    const row = database.query(query.sql).get(...query.values) as { snapshot_json: string } | null
    if (row === null) throw new Error(`missing ${kind}`)
    return JSON.parse(row.snapshot_json)
  })
  expect(snapshots[0]).toMatchObject({ format: "room-record", version: 2 })
  expect(snapshots[0].room).toEqual({
    id: ROOM_ID,
    legacy_id: "1",
    name: "Conference A",
    capacity: 8,
    location: "Floor 2",
    created_at: "2026-01-01T00:00:00.000Z",
  })
  expect(snapshots[1]).toMatchObject({ format: "room-reservation-record", version: 2 })
  expect(snapshots[1].reservation).toMatchObject({
    id: "5e0f7c3a-1d2b-4c5d-8e6f-000000000002",
    room_id: ROOM_ID,
    reserver_id: "employee-1",
    start_at: "2026-09-15T09:00:00.000Z",
    end_at: "2026-09-15T10:00:00.000Z",
    purpose: "Planning",
  })
  expect(roomSnapshotQuery("room-record", "1")).toBeInstanceOf(Error)
  expect(roomSnapshotQuery("room-reservation-record", "reservation-2")).toBeInstanceOf(Error)
  database.close()
})
