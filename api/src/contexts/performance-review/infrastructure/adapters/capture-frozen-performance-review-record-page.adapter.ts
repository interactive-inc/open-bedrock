import { z } from "zod"
import type { PerformanceReviewContext } from "@/contexts/performance-review/configuration/performance-review-context"
import { performanceReviewRecordKindSchema } from "@/contexts/performance-review/domain/definitions/performance-review-record-kind.definition"
import { ListFrozenPerformanceReviewRecordPageAdapter } from "@/contexts/performance-review/infrastructure/adapters/list-frozen-performance-review-record-page.adapter"
import { CapturePerformanceReviewRecordAdapter } from "@/contexts/performance-review/infrastructure/adapters/capture-performance-review-record.adapter"

type Context = PerformanceReviewContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: performanceReviewRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止した人事評価台帳の原文を分割取得し、全取得後にも同じ停止世代を検査する。 */
export class CaptureFrozenPerformanceReviewRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenPerformanceReviewRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CapturePerformanceReviewRecordAdapter(this.c).prepare({
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
        return new Error("frozen performanceReview capture changed")
    } catch (cause) {
      return new Error("frozen performanceReview capture changed", { cause })
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
