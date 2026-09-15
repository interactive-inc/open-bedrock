import type { AssetContext } from "@/contexts/asset/configuration/asset-context"
import { AssetActorReadAdapter } from "@/contexts/asset/infrastructure/adapters/asset-actor-read.adapter"
import { AssetError } from "@/contexts/asset/domain/errors"
import {
  assetRecordKindSchema,
  decodeStocktakeItemRecordId,
  type AssetRecordKind,
} from "@/contexts/asset/domain/asset-record-kind"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { z } from "zod"

type Context = AssetContext

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string | number> }>

function snapshotQuery(recordKind: AssetRecordKind, recordId: string): SnapshotQuery | Error {
  if (recordKind === "asset-record") {
    if (!z.string().trim().min(1).max(255).safeParse(recordId).success) return new Error("invalid asset id")
    return {
      sql: `SELECT json_object('format','asset-record','version',1,'asset',json_object(
        'code',code,'name',name,'kind',kind,'serial',serial,'purchased_on',purchased_on,
        'status',status,'holder_employee_id',holder_employee_id,'disposed_on',disposed_on,
        'disposal_reason',disposal_reason)) AS snapshot_json FROM assets WHERE code=?1`,
      values: [recordId],
    }
  }
  if (recordKind === "asset-lending-record") {
    const id = z.coerce.number().int().positive().safe().safeParse(recordId)
    if (!id.success || String(id.data) !== recordId) return new Error("invalid lending id")
    return {
      sql: `SELECT json_object('format','asset-lending-record','version',1,'lending',json_object(
        'id',id,'asset_code',asset_code,'employee_id',employee_id,'lent_at',lent_at,
        'returned_at',returned_at)) AS snapshot_json FROM asset_lendings WHERE id=?1`,
      values: [id.data],
    }
  }
  if (recordKind === "stocktake-record") {
    if (!z.uuid().safeParse(recordId).success) return new Error("invalid stocktake id")
    return {
      sql: `SELECT json_object('format','stocktake-record','version',1,'stocktake',json_object(
        'id',id,'name',name,'target_date',target_date,'status',status,'created_at',created_at,
        'closed_at',closed_at)) AS snapshot_json FROM stocktakes WHERE id=?1`,
      values: [recordId],
    }
  }
  const item = decodeStocktakeItemRecordId(recordId)
  if (item === null || !z.uuid().safeParse(item.stocktakeId).success) return new Error("invalid stocktake item id")
  return {
    sql: `SELECT json_object('format','stocktake-item-record','version',1,'item',json_object(
      'stocktake_id',stocktake_id,'asset_code',asset_code,'checked_at',checked_at,
      'checker_employee_id',checker_employee_id,'location_note',location_note)) AS snapshot_json
      FROM stocktake_items WHERE stocktake_id=?1 AND asset_code=?2`,
    values: [item.stocktakeId, item.assetCode],
  }
}

/** 保全資格のある主体へ資産4台帳の原記録を返し、保存直前にも同じ内容を検査する。 */
export class CaptureAssetRecordAdapter {
  constructor(private readonly c: Context) { Object.freeze(this) }

  async prepare(input: Readonly<{ recordKind: AssetRecordKind; recordId: string; sourceNamespace: string }>) {
    const kind = assetRecordKindSchema.safeParse(input.recordKind)
    if (!kind.success) return new AssetError("forbidden", "invalid source record")
    const query = snapshotQuery(kind.data, input.recordId)
    if (query instanceof Error) return new AssetError("forbidden", "invalid source record", { cause: query })
    const actor = await new AssetActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const statement = () => this.c.env.DB.prepare(query.sql).bind(...query.values)
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([...actor.assertions, statement()])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("asset source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("asset source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "asset",
        recordKind: kind.data,
        recordId: input.recordId,
        formatId: kind.data,
        formatVersion: 1,
        sourceRevision: null,
        sourceRecordedAt: null,
        capturedAt: actor.now.toISOString(),
        contentDigest: digest.toString(),
      })
      if (source instanceof Error) return source
      return {
        source,
        content: new TextEncoder().encode(canonical.toString()),
        actorAccountId: actor.accountId,
        sourceAuthorizationRef: Object.freeze({
          context: "asset", kind: "record-snapshot", id: input.recordId, version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN (SELECT snapshot_json FROM (${query.sql})) IS ?${query.values.length + 1}
            THEN 1 ELSE json_extract('', '$') END`).bind(...query.values, snapshot),
        ],
      }
    } catch (cause) {
      return new Error("asset source capture failed", { cause })
    }
  }
}
