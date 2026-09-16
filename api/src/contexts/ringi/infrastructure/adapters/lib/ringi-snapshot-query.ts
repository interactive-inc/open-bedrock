import {
  decodeRingiProcedureBindingRecordId,
  type RingiRecordKind,
} from "@/contexts/ringi/domain/definitions/ringi-record-kind.definition"
import { z } from "zod"

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string | number> }>

/** 稟議起案とSystem案件対応の全列を形式番号付きの原文にする。 */
export function ringiSnapshotQuery(
  recordKind: RingiRecordKind,
  recordId: string,
): SnapshotQuery | Error {
  if (recordKind === "ringi-request-record") {
    const parsed = z.coerce.number().int().safe().safeParse(recordId)
    if (!parsed.success || String(parsed.data) !== recordId)
      return new Error("invalid ringi request id")
    return {
      sql: `SELECT json_object('format','ringi-request-record','version',1,'request',json_object(
        'id',id,'applicant_id',applicant_id,'approver_id',approver_id,'title',title,
        'amount',amount,'reason',reason,'status',status,'decided_at',decided_at,
        'decision_comment',decision_comment,'created_at',created_at)) AS snapshot_json
        FROM ringi_requests WHERE id=?1`,
      values: [parsed.data],
    }
  }
  const key = decodeRingiProcedureBindingRecordId(recordId)
  if (key === null) return new Error("invalid ringi procedure binding id")
  return {
    sql: `SELECT json_object('format','ringi-procedure-binding-record','version',1,'binding',json_object(
      'previous_ringi_id',previous_ringi_id,'request_key',request_key,'ringi_id',ringi_id,
      'application_id',application_id,'series_id',series_id,'case_id',case_id,
      'proposal_digest',proposal_digest,'created_at',created_at)) AS snapshot_json
      FROM ringi_procedure_bindings WHERE request_key=?1`,
    values: [key],
  }
}
