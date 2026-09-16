import type { MeetingRecordKind } from "@/contexts/meeting/domain/definitions/meeting-record-kind.definition"
import { z } from "zod"

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string | number> }>

/** 会議3台帳の全列を、不変な形式番号付きの原文にする。 */
export function meetingSnapshotQuery(
  recordKind: MeetingRecordKind,
  recordId: string,
): SnapshotQuery | Error {
  const parsed = z.coerce.number().int().positive().safe().safeParse(recordId)
  if (!parsed.success || String(parsed.data) !== recordId)
    return new Error("invalid meeting record id")
  const id = parsed.data
  if (recordKind === "meeting-record")
    return {
      sql: `SELECT json_object('format','meeting-record','version',1,'meeting',json_object(
        'id',id,'code',code,'name',name,'cadence',cadence,'description',description,
        'status',status,'created_at',created_at)) AS snapshot_json FROM meetings WHERE id=?1`,
      values: [id],
    }
  if (recordKind === "meeting-minutes-record")
    return {
      sql: `SELECT json_object('format','meeting-minutes-record','version',1,'minutes',json_object(
        'id',id,'meeting_id',meeting_id,'held_on',held_on,'title',title,'attendees',attendees,
        'body_md',body_md,'author_employee_id',author_employee_id,'created_at',created_at))
        AS snapshot_json FROM meeting_minutes_records WHERE id=?1`,
      values: [id],
    }
  return {
    sql: `SELECT json_object('format','meeting-decision-record','version',1,'decision',json_object(
      'id',id,'title',title,'decided_on',decided_on,'context',context,'decision',decision,
      'consequences',consequences,'status',status,'superseded_by_id',superseded_by_id,
      'created_at',created_at)) AS snapshot_json FROM decision_records WHERE id=?1`,
    values: [id],
  }
}
