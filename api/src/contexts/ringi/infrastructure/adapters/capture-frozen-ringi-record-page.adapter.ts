import { z } from "zod"
import type { RingiContext } from "@/contexts/ringi/configuration/ringi-context"
import { ringiRecordKindSchema } from "@/contexts/ringi/domain/definitions/ringi-record-kind.definition"
import { ListFrozenRingiRecordPageAdapter } from "@/contexts/ringi/infrastructure/adapters/list-frozen-ringi-record-page.adapter"
import { CaptureRingiRecordAdapter } from "@/contexts/ringi/infrastructure/adapters/capture-ringi-record.adapter"

type Context = RingiContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: ringiRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止した稟議台帳の原文を分割取得し、全取得後にも同じ停止世代を検査する。 */
export class CaptureFrozenRingiRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenRingiRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CaptureRingiRecordAdapter(this.c).prepare({
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
        return new Error("frozen ringi capture changed")
    } catch (cause) {
      return new Error("frozen ringi capture changed", { cause })
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
