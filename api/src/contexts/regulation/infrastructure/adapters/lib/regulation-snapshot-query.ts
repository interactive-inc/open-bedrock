import type { RegulationRecordKind } from "@/contexts/regulation/domain/definitions/regulation-record-kind.definition"
import { z } from "zod"

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string> }>

/** 規程と改定版の全列を、不変な形式番号付きの原文にする。 */
export function regulationSnapshotQuery(
  recordKind: RegulationRecordKind,
  recordId: string,
): SnapshotQuery | Error {
  const parsed = z.uuid().safeParse(recordId)
  if (!parsed.success) return new Error("invalid regulation record id")
  const id = parsed.data
  if (recordKind === "regulation-record")
    return {
      sql: `SELECT json_object('format','regulation-record','version',2,'regulation',json_object(
        'id',id,'legacy_id',legacy_id,'code',code,'title',title,'category',category,'status',status,
        'created_at',created_at)) AS snapshot_json FROM regulations WHERE id=?1`,
      values: [id],
    }
  return {
    sql: `SELECT json_object('format','regulation-version-record','version',2,'revision',json_object(
      'id',id,'legacy_id',legacy_id,'regulation_id',regulation_id,'version',version,'body_md',body_md,
      'effective_on',effective_on,'note',note,'created_at',created_at)) AS snapshot_json
      FROM regulation_versions WHERE id=?1`,
    values: [id],
  }
}
