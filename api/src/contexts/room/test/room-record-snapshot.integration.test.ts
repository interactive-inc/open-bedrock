import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { roomSnapshotQuery } from "@/contexts/room/infrastructure/adapters/lib/room-snapshot-query"
import type { RoomRecordKind } from "@/contexts/room/domain/definitions/room-record-kind.definition"

test("会議室と予約の全列を原記録に残す", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE rooms (id INTEGER PRIMARY KEY, name TEXT, capacity INTEGER, location TEXT);
    CREATE TABLE room_reservations (
      id TEXT PRIMARY KEY, room_id INTEGER, reserver_id TEXT, start_at TEXT,
      end_at TEXT, purpose TEXT
    );
    INSERT INTO rooms VALUES (1,'Conference A',8,'Floor 2');
    INSERT INTO room_reservations VALUES (
      '5e0f7c3a-1d2b-4c5d-8e6f-000000000002',1,'employee-1','2026-09-15T09:00:00.000Z',
      '2026-09-15T10:00:00.000Z','Planning'
    );
  `)
  const sources: ReadonlyArray<readonly [RoomRecordKind, string]> = [
    ["room-record", "1"],
    ["room-reservation-record", "5e0f7c3a-1d2b-4c5d-8e6f-000000000002"],
  ]
  const snapshots = sources.map(([kind, id]) => {
    const query = roomSnapshotQuery(kind, id)
    if (query instanceof Error) throw query
    const row = database.query(query.sql).get(...query.values) as { snapshot_json: string } | null
    if (row === null) throw new Error(`missing ${kind}`)
    return JSON.parse(row.snapshot_json)
  })
  expect(snapshots[0].room).toMatchObject({
    id: 1,
    name: "Conference A",
    capacity: 8,
    location: "Floor 2",
  })
  expect(snapshots[1].reservation).toMatchObject({
    id: "5e0f7c3a-1d2b-4c5d-8e6f-000000000002",
    room_id: 1,
    reserver_id: "employee-1",
    start_at: "2026-09-15T09:00:00.000Z",
    end_at: "2026-09-15T10:00:00.000Z",
    purpose: "Planning",
  })
  expect(roomSnapshotQuery("room-record", "01")).toBeInstanceOf(Error)
  database.close()
})
