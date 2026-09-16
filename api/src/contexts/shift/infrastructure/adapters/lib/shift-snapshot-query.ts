import type { ShiftRecordKind } from "@/contexts/shift/domain/definitions/shift-record-kind.definition"
import { z } from "zod"

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string | number> }>

/** シフト3台帳の全列を、不変な形式番号付きの原文にする。 */
export function shiftSnapshotQuery(
  recordKind: ShiftRecordKind,
  recordId: string,
): SnapshotQuery | Error {
  const parsed = z.coerce.number().int().positive().safe().safeParse(recordId)
  if (!parsed.success || String(parsed.data) !== recordId)
    return new Error("invalid shift record id")
  const id = parsed.data
  if (recordKind === "shift-pattern-record")
    return {
      sql: `SELECT json_object('format','shift-pattern-record','version',1,'pattern',json_object(
        'id',id,'code',code,'name',name,'start_time',start_time,'end_time',end_time,
        'break_minutes',break_minutes)) AS snapshot_json FROM shift_patterns WHERE id=?1`,
      values: [id],
    }
  if (recordKind === "shift-assignment-record")
    return {
      sql: `SELECT json_object('format','shift-assignment-record','version',1,'assignment',json_object(
        'id',id,'employee_id',employee_id,'pattern_id',pattern_id,'date',date,
        'note',note,'published_at',published_at))
        AS snapshot_json FROM shift_assignments WHERE id=?1`,
      values: [id],
    }
  return {
    sql: `SELECT json_object('format','shift-swap-request-record','version',1,'swapRequest',json_object(
      'id',id,'requester_employee_id',requester_employee_id,
      'target_employee_id',target_employee_id,'date',date,'note',note,'status',status,
      'approved_at',approved_at)) AS snapshot_json FROM shift_swap_requests WHERE id=?1`,
    values: [id],
  }
}
