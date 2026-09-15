import { z } from "zod"
import type { CommendationContext } from "@/contexts/commendation/configuration/commendation-context"
import { ListFrozenCommendationRecordPageAdapter } from "@/contexts/commendation/infrastructure/adapters/list-frozen-commendation-record-page.adapter"
import { CaptureCommendationRecordAdapter } from "@/contexts/commendation/infrastructure/adapters/capture-commendation-record.adapter"

type Context = CommendationContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  afterId: z.number().int().nonnegative().safe(),
  limit: z.number().int().min(1).max(10),
})

/** 停止した表彰記録の原文を分割取得し、全取得後と後続保存時にも同じ停止世代を検査する。 */
export class CaptureFrozenCommendationRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenCommendationRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CaptureCommendationRecordAdapter(this.c).prepare({
        commendationId: recordId,
        sourceNamespace: request.sourceNamespace,
      })
      if (record instanceof Error) return record
      records.push(record)
    }
    // 停止中は業務DBの全writerが拒否されるため、末尾で世代を確認すれば途中の解除も検知できる。
    try {
      const checks = await this.c.env.DB.batch([...page.assertions])
      if (checks.length !== page.assertions.length || checks.some((check) => !check.success))
        return new Error("frozen commendation capture changed")
    } catch (cause) {
      return new Error("frozen commendation capture changed", { cause })
    }
    return Object.freeze({
      freezeId: page.freezeId,
      afterId: request.afterId,
      nextAfterId: page.nextAfterId,
      records: Object.freeze(records),
      assertions: page.assertions,
    })
  }
}
