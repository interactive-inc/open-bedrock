import { z } from "zod"
import type { AssetContext } from "@/contexts/asset/configuration/asset-context"
import { AssetActorReadAdapter } from "@/contexts/asset/infrastructure/adapters/asset-actor-read.adapter"
import {
  assetRecordKindSchema,
  decodeStocktakeItemRecordId,
  encodeStocktakeItemRecordId,
} from "@/contexts/asset/domain/definitions/asset-record-kind.definition"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"

type Context = AssetContext
const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  recordKind: assetRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(100),
})

/** 未解除の停止世代から指定した資産台帳のIDを分割取得し、同じ停止世代を検査する。 */
export class ListFrozenAssetRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new AssetActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await new RecordSourceFreezeRepository({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "asset",
    })
    if (generation instanceof Error) return generation
    const query = this.query(request.recordKind, request.afterCursor, request.limit + 1)
    if (query instanceof Error) return query
    try {
      const statements = [
        ...generation.assertions,
        this.c.env.DB.prepare(query.sql).bind(...query.values),
        ...generation.assertions,
      ]
      const reads = await this.c.env.DB.batch<{
        record_id: string | number
        stocktake_id?: string
        asset_code?: string
      }>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen asset inventory unavailable")
      const rows = reads[generation.assertions.length]?.results ?? []
      const ids = rows.map((row) =>
        request.recordKind === "stocktake-item-record"
          ? encodeStocktakeItemRecordId(String(row.stocktake_id), String(row.asset_code))
          : String(row.record_id),
      )
      if (new Set(ids).size !== ids.length || ids.some((id) => id.length === 0))
        return new Error("invalid asset inventory")
      const recordIds = ids.slice(0, request.limit)
      return Object.freeze({
        freezeId: generation.freeze.snapshot.id,
        recordIds: Object.freeze(recordIds),
        nextCursor: ids.length > request.limit ? (recordIds.at(-1) ?? null) : null,
        assertions: generation.assertions,
      })
    } catch (cause) {
      return new Error("frozen asset inventory unavailable", { cause })
    }
  }

  private query(kind: z.infer<typeof assetRecordKindSchema>, cursor: string | null, limit: number) {
    if (kind === "asset-record")
      return cursor === null
        ? { sql: "SELECT code AS record_id FROM assets ORDER BY code LIMIT ?1", values: [limit] }
        : {
            sql: "SELECT code AS record_id FROM assets WHERE code>?1 ORDER BY code LIMIT ?2",
            values: [cursor, limit],
          }
    if (kind === "asset-lending-record") {
      const after = cursor === null ? null : Number(cursor)
      if (after !== null && (!Number.isSafeInteger(after) || String(after) !== cursor))
        return new Error("invalid lending cursor")
      return after === null
        ? {
            sql: "SELECT id AS record_id FROM asset_lendings ORDER BY id LIMIT ?1",
            values: [limit],
          }
        : {
            sql: "SELECT id AS record_id FROM asset_lendings WHERE id>?1 ORDER BY id LIMIT ?2",
            values: [after, limit],
          }
    }
    if (kind === "stocktake-record")
      return cursor === null
        ? { sql: "SELECT id AS record_id FROM stocktakes ORDER BY id LIMIT ?1", values: [limit] }
        : {
            sql: "SELECT id AS record_id FROM stocktakes WHERE id>?1 ORDER BY id LIMIT ?2",
            values: [cursor, limit],
          }
    const item = cursor === null ? null : decodeStocktakeItemRecordId(cursor)
    if (cursor !== null && item === null) return new Error("invalid stocktake item cursor")
    return item === null
      ? {
          sql: `SELECT stocktake_id,asset_code FROM stocktake_items
            ORDER BY stocktake_id,asset_code LIMIT ?1`,
          values: [limit],
        }
      : {
          sql: `SELECT stocktake_id,asset_code FROM stocktake_items
            WHERE stocktake_id>?1 OR (stocktake_id=?1 AND asset_code>?2)
            ORDER BY stocktake_id,asset_code LIMIT ?3`,
          values: [item.stocktakeId, item.assetCode, limit],
        }
  }
}
