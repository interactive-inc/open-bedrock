import { z } from "zod"
import type { RecruitmentContext } from "@/contexts/recruitment/configuration/recruitment-context"
import { recruitmentRecordKindSchema } from "@/contexts/recruitment/domain/definitions/recruitment-record-kind.definition"
import { ListFrozenRecruitmentRecordPageAdapter } from "@/contexts/recruitment/infrastructure/adapters/list-frozen-recruitment-record-page.adapter"
import { CaptureRecruitmentRecordAdapter } from "@/contexts/recruitment/infrastructure/adapters/capture-recruitment-record.adapter"

type Context = RecruitmentContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: recruitmentRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止した採用台帳の原文を分割取得し、全取得後にも同じ停止世代を検査する。 */
export class CaptureFrozenRecruitmentRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenRecruitmentRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CaptureRecruitmentRecordAdapter(this.c).prepare({
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
        return new Error("frozen recruitment capture changed")
    } catch (cause) {
      return new Error("frozen recruitment capture changed", { cause })
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
