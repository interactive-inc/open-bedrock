import type { RecruitmentRecordKind } from "@/contexts/recruitment/domain/definitions/recruitment-record-kind.definition"
import { z } from "zod"

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string | number> }>

/** 募集ポジションと応募者の全列を、不変な形式番号付きの原文にする。 */
export function recruitmentSnapshotQuery(
  recordKind: RecruitmentRecordKind,
  recordId: string,
): SnapshotQuery | Error {
  const parsed = z.coerce.number().int().safe().safeParse(recordId)
  if (!parsed.success || String(parsed.data) !== recordId)
    return new Error("invalid recruitment record id")
  const id = parsed.data
  if (recordKind === "recruitment-position-record")
    return {
      sql: `SELECT json_object('format','recruitment-position-record','version',1,'position',json_object(
        'id',id,'title',title,'department_code',department_code,'status',status,
        'note',note,'created_at',created_at)) AS snapshot_json FROM job_openings WHERE id=?1`,
      values: [id],
    }
  return {
    sql: `SELECT json_object('format','recruitment-candidate-record','version',1,'candidate',json_object(
      'id',id,'position_id',position_id,'name',name,'email',email,'source',source,
      'stage',stage,'note',note,'created_at',created_at)) AS snapshot_json
      FROM recruitment_candidates WHERE id=?1`,
    values: [id],
  }
}
