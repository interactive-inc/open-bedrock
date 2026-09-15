import { z } from "zod"
import type { AssetContext } from "@/contexts/asset/configuration/asset-context"
import { assetRecordKindSchema } from "@/contexts/asset/domain/definitions/asset-record-kind.definition"
import { ListFrozenAssetRecordPageAdapter } from "@/contexts/asset/infrastructure/adapters/list-frozen-asset-record-page.adapter"
import { CaptureAssetRecordAdapter } from "@/contexts/asset/infrastructure/adapters/capture-asset-record.adapter"

type Context = AssetContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: assetRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止した資産台帳の原文を分割取得し、全取得後にも同じ停止世代を検査する。 */
export class CaptureFrozenAssetRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenAssetRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CaptureAssetRecordAdapter(this.c).prepare({
        recordKind: request.recordKind,
        recordId,
        sourceNamespace: request.sourceNamespace,
      })
      if (record instanceof Error) return record
      records.push(record)
    }
    try {
      const checks = await this.c.env.DB.batch([...page.assertions])
      if (checks.length !== page.assertions.length || checks.some((check) => !check.success))
        return new Error("frozen asset capture changed")
    } catch (cause) {
      return new Error("frozen asset capture changed", { cause })
    }
    return Object.freeze({
      freezeId: page.freezeId,
      afterCursor: request.afterCursor,
      nextCursor: page.nextCursor,
      records: Object.freeze(records),
      assertions: page.assertions,
    })
  }
}
