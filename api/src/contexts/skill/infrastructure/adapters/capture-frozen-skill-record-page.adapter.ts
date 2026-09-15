import { z } from "zod"
import type { SkillContext } from "@/contexts/skill/configuration/skill-context"
import { skillRecordKindSchema } from "@/contexts/skill/domain/skill-record-kind"
import { ListFrozenSkillRecordPageAdapter } from "@/contexts/skill/infrastructure/adapters/list-frozen-skill-record-page.adapter"
import { CaptureSkillRecordAdapter } from "@/contexts/skill/infrastructure/adapters/capture-skill-record.adapter"

type Context = SkillContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(), sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: skillRecordKindSchema, afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止したスキル台帳の原文を分割取得し、全取得後にも同じ停止世代を検査する。 */
export class CaptureFrozenSkillRecordPageAdapter {
  constructor(private readonly c: Context) { Object.freeze(this) }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenSkillRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CaptureSkillRecordAdapter(this.c).prepare({
        recordKind: request.recordKind, recordId, sourceNamespace: request.sourceNamespace,
      })
      if (record instanceof Error) return record
      records.push(record)
    }
    try {
      const checks = await this.c.env.DB.batch([...page.assertions])
      if (checks.length !== page.assertions.length || checks.some((check) => !check.success))
        return new Error("frozen skill capture changed")
    } catch (cause) {
      return new Error("frozen skill capture changed", { cause })
    }
    return Object.freeze({
      freezeId: page.freezeId, afterCursor: request.afterCursor, nextCursor: page.nextCursor,
      records: Object.freeze(records), assertions: page.assertions,
    })
  }
}
