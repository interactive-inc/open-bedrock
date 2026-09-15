import { z } from "zod"
import type { ThanksContext } from "@/contexts/thanks/configuration/thanks-context"
import { thanksRecordKindSchema } from "@/contexts/thanks/domain/definitions/thanks-record-kind.definition"
import { ListFrozenThanksRecordPageAdapter } from "@/contexts/thanks/infrastructure/adapters/list-frozen-thanks-record-page.adapter"
import { CaptureThanksRecordAdapter } from "@/contexts/thanks/infrastructure/adapters/capture-thanks-record.adapter"

type Context = ThanksContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: thanksRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止したサンクス台帳の原文を分割取得し、全取得後にも同じ停止世代を検査する。 */
export class CaptureFrozenThanksRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenThanksRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CaptureThanksRecordAdapter(this.c).prepare({
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
        return new Error("frozen thanks capture changed")
    } catch (cause) {
      return new Error("frozen thanks capture changed", { cause })
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
