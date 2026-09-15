import { z } from "zod"
import type { CareerContext } from "@/contexts/career/configuration/career-context"
import { careerRecordKindSchema } from "@/contexts/career/domain/definitions/career-record-kind.definition"
import { ListFrozenCareerRecordPageAdapter } from "@/contexts/career/infrastructure/adapters/list-frozen-career-record-page.adapter"
import { CaptureCareerRecordAdapter } from "@/contexts/career/infrastructure/adapters/capture-career-record.adapter"

type Context = CareerContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: careerRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止したキャリア公募・応募・シートの原文を分割取得し、全取得後にも同じ停止世代を検査する。 */
export class CaptureFrozenCareerRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenCareerRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CaptureCareerRecordAdapter(this.c).prepare({
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
        return new Error("frozen career capture changed")
    } catch (cause) {
      return new Error("frozen career capture changed", { cause })
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
