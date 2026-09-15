import { z } from "zod"
import type { AntisocialCheckContext } from "@/contexts/antisocial-check/configuration/antisocial-check-context"
import { ListFrozenAntisocialCheckRecordPageAdapter } from "@/contexts/antisocial-check/infrastructure/adapters/list-frozen-antisocial-check-record-page.adapter"
import { CaptureAntisocialCheckRecordAdapter } from "@/contexts/antisocial-check/infrastructure/adapters/capture-antisocial-check-record.adapter"

type Context = AntisocialCheckContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  afterId: z.uuid().nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止したantisocial check記録の原文を分割取得し、全取得後と後続保存時にも同じ停止世代を検査する。 */
export class CaptureFrozenAntisocialCheckRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenAntisocialCheckRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CaptureAntisocialCheckRecordAdapter(this.c).prepare({
        antisocialCheckId: recordId,
        sourceNamespace: request.sourceNamespace,
      })
      if (record instanceof Error) return record
      records.push(record)
    }
    // 停止中は業務DBの全writerが拒否されるため、末尾で世代を確認すれば途中の解除も検知できる。
    try {
      const checks = await this.c.env.DB.batch([...page.assertions])
      if (checks.length !== page.assertions.length || checks.some((check) => !check.success))
        return new Error("frozen antisocial-check capture changed")
    } catch (cause) {
      return new Error("frozen antisocial-check capture changed", { cause })
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
