import { z } from "zod"
import type { CompensationChangeContext } from "@/contexts/compensation-change/configuration/compensation-change-context"
import { compensationChangeRecordKindSchema } from "@/contexts/compensation-change/domain/compensation-change-record-kind"
import { ListFrozenCompensationChangeRecordPageAdapter } from "@/contexts/compensation-change/infrastructure/adapters/list-frozen-compensation-change-record-page.adapter"
import { CaptureCompensationChangeRecordAdapter } from "@/contexts/compensation-change/infrastructure/adapters/capture-compensation-change-record.adapter"

type Context = CompensationChangeContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(), sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: compensationChangeRecordKindSchema, afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止した給与改定の原文を分割取得し、全取得後にも同じ停止世代を検査する。 */
export class CaptureFrozenCompensationChangeRecordPageAdapter {
  constructor(private readonly c: Context) { Object.freeze(this) }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenCompensationChangeRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CaptureCompensationChangeRecordAdapter(this.c).prepare({
        recordKind: request.recordKind, recordId, sourceNamespace: request.sourceNamespace,
      })
      if (record instanceof Error) return record
      records.push(record)
    }
    try {
      const checks = await this.c.env.DB.batch([...page.assertions])
      if (checks.length !== page.assertions.length || checks.some((check) => !check.success))
        return new Error("frozen compensation-change capture changed")
    } catch (cause) {
      return new Error("frozen compensation-change capture changed", { cause })
    }
    return Object.freeze({
      freezeId: page.freezeId, afterCursor: request.afterCursor, nextCursor: page.nextCursor,
      records: Object.freeze(records), assertions: page.assertions,
    })
  }
}
