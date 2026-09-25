import type { ShiftRecordKind } from "@/contexts/shift/domain/definitions/shift-record-kind.definition"
import { z } from "zod"

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string>; formatVersion: number }>

/**
 * シフト3台帳の全列を、不変な形式番号付きの原文にする。
 * 版 2 は主キーを UUID へ移し、移行前の整数の主キー（legacy_id）と作成日時を含める。
 */
export function shiftSnapshotQuery(
  recordKind: ShiftRecordKind,
  recordId: string,
): SnapshotQuery | Error {
  if (!z.uuid().safeParse(recordId).success) return new Error("invalid shift record id")
  if (recordKind === "shift-pattern-record")
    return {
      sql: `SELECT json_object('format','shift-pattern-record','version',2,'pattern',json_object(
        'id',id,'legacy_id',legacy_id,'code',code,'name',name,'start_time',start_time,
        'end_time',end_time,'break_minutes',break_minutes,'created_at',created_at))
        AS snapshot_json FROM shift_patterns WHERE id=?1`,
      values: [recordId],
      formatVersion: 2,
    }
  if (recordKind === "shift-assignment-record")
    return {
      sql: `SELECT json_object('format','shift-assignment-record','version',2,'assignment',json_object(
        'id',id,'legacy_id',legacy_id,'employee_id',employee_id,'pattern_id',pattern_id,'date',date,
        'note',note,'published_at',published_at,'created_at',created_at))
        AS snapshot_json FROM shift_assignments WHERE id=?1`,
      values: [recordId],
      formatVersion: 2,
    }
  return {
    sql: `SELECT json_object('format','shift-swap-request-record','version',2,'swapRequest',json_object(
      'id',id,'legacy_id',legacy_id,'requester_employee_id',requester_employee_id,
      'target_employee_id',target_employee_id,'date',date,'note',note,'status',status,
      'approved_at',approved_at,'created_at',created_at)) AS snapshot_json
      FROM shift_swap_requests WHERE id=?1`,
    values: [recordId],
    formatVersion: 2,
  }
}
