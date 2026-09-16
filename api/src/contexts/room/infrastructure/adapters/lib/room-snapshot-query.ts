import type { RoomRecordKind } from "@/contexts/room/domain/definitions/room-record-kind.definition"
import { z } from "zod"

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string | number> }>

/** 会議室と予約の全列を、不変な形式番号付きの原文にする。 */
export function roomSnapshotQuery(
  recordKind: RoomRecordKind,
  recordId: string,
): SnapshotQuery | Error {
  if (recordKind === "room-record") {
    const parsed = z.coerce.number().int().positive().safe().safeParse(recordId)
    if (!parsed.success || String(parsed.data) !== recordId)
      return new Error("invalid room record id")
    return {
      sql: `SELECT json_object('format','room-record','version',1,'room',json_object(
        'id',id,'name',name,'capacity',capacity,'location',location)) AS snapshot_json
        FROM rooms WHERE id=?1`,
      values: [parsed.data],
    }
  }
  if (recordId.length === 0 || recordId.length > 1000)
    return new Error("invalid room reservation id")
  return {
    sql: `SELECT json_object('format','room-reservation-record','version',1,'reservation',json_object(
      'id',id,'room_id',room_id,'reserver_id',reserver_id,'start_at',start_at,
      'end_at',end_at,'purpose',purpose)) AS snapshot_json
      FROM room_reservations WHERE id=?1`,
    values: [recordId],
  }
}
