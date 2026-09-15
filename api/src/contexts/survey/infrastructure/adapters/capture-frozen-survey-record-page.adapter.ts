import { z } from "zod"
import type { SurveyContext } from "@/contexts/survey/configuration/survey-context"
import { surveyRecordKindSchema } from "@/contexts/survey/domain/survey-record-kind"
import { ListFrozenSurveyRecordPageAdapter } from "@/contexts/survey/infrastructure/adapters/list-frozen-survey-record-page.adapter"
import { CaptureSurveyRecordAdapter } from "@/contexts/survey/infrastructure/adapters/capture-survey-record.adapter"

type Context = SurveyContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(), sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: surveyRecordKindSchema, afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止したアンケート本体・回答の原文を分割取得し、全取得後にも同じ停止世代を検査する。 */
export class CaptureFrozenSurveyRecordPageAdapter {
  constructor(private readonly c: Context) { Object.freeze(this) }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenSurveyRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CaptureSurveyRecordAdapter(this.c).prepare({
        recordKind: request.recordKind, recordId, sourceNamespace: request.sourceNamespace,
      })
      if (record instanceof Error) return record
      records.push(record)
    }
    try {
      const checks = await this.c.env.DB.batch([...page.assertions])
      if (checks.length !== page.assertions.length || checks.some((check) => !check.success))
        return new Error("frozen survey capture changed")
    } catch (cause) {
      return new Error("frozen survey capture changed", { cause })
    }
    return Object.freeze({
      freezeId: page.freezeId, afterCursor: request.afterCursor, nextCursor: page.nextCursor,
      records: Object.freeze(records), assertions: page.assertions,
    })
  }
}
