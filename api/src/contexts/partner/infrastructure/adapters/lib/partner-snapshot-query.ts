import type { PartnerRecordKind } from "@/contexts/partner/domain/definitions/partner-record-kind.definition"
import { z } from "zod"

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string> }>

/** 取引先と契約記録の全列を、不変な形式番号付きの原文にする。 */
export function partnerSnapshotQuery(
  recordKind: PartnerRecordKind,
  recordId: string,
): SnapshotQuery | Error {
  const parsed = z.uuid().safeParse(recordId)
  if (!parsed.success) return new Error("invalid partner record id")
  const id = parsed.data
  if (recordKind === "partner-record")
    return {
      sql: `SELECT json_object('format','partner-record','version',2,'partner',json_object(
        'id',id,'legacy_id',legacy_id,'code',code,'name',name,'category',category,'corporate_number',corporate_number,
        'note',note,'status',status,
        'created_at',created_at)) AS snapshot_json FROM partners WHERE id=?1`,
      values: [id],
    }
  return {
    sql: `SELECT json_object('format','partner-contract-record','version',2,'contract',json_object(
      'id',id,'legacy_id',legacy_id,'partner_id',partner_id,'title',title,'contract_date',contract_date,
      'starts_on',starts_on,'ends_on',ends_on,'renewal_deadline',renewal_deadline,
      'note',note,'created_at',created_at)) AS snapshot_json
      FROM partner_contracts WHERE id=?1`,
    values: [id],
  }
}
