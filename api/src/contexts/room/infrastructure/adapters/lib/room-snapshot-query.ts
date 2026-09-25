import type { RoomRecordKind } from "@/contexts/room/domain/definitions/room-record-kind.definition"
import { z } from "zod"

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string>; formatVersion: number }>

/**
 * 会議室と予約の全列を、不変な形式番号付きの原文にする。
 * 会議室の版 2 は主キーを UUID へ移し、移行前の整数の主キー（legacy_id）と作成日時を含める。
 * 予約の版 2 は room_id が会議室の UUID を指す。
 */
export function roomSnapshotQuery(
  recordKind: RoomRecordKind,
  recordId: string,
): SnapshotQuery | Error {
  if (recordKind === "room-record") {
    if (!z.uuid().safeParse(recordId).success) return new Error("invalid room record id")
    return {
      sql: `SELECT json_object('format','room-record','version',2,'room',json_object(
        'id',id,'legacy_id',legacy_id,'name',name,'capacity',capacity,'location',location,
        'created_at',created_at)) AS snapshot_json
        FROM rooms WHERE id=?1`,
      values: [recordId],
      formatVersion: 2,
    }
  }
  if (!z.uuid().safeParse(recordId).success) return new Error("invalid room reservation id")
  return {
    sql: `SELECT json_object('format','room-reservation-record','version',2,'reservation',json_object(
      'id',id,'room_id',room_id,'reserver_id',reserver_id,'start_at',start_at,
      'end_at',end_at,'purpose',purpose)) AS snapshot_json
      FROM room_reservations WHERE id=?1`,
    values: [recordId],
    formatVersion: 2,
  }
}
