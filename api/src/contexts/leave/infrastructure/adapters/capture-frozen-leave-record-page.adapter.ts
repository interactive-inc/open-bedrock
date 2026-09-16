import { z } from "zod"
import type { LeaveContext } from "@/contexts/leave/configuration/leave-context"
import { leaveRecordKindSchema } from "@/contexts/leave/domain/definitions/leave-record-kind.definition"
import { ListFrozenLeaveRecordPageAdapter } from "@/contexts/leave/infrastructure/adapters/list-frozen-leave-record-page.adapter"
import { CaptureLeaveRecordAdapter } from "@/contexts/leave/infrastructure/adapters/capture-leave-record.adapter"

type Context = LeaveContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: leaveRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止した休暇台帳の原文を分割取得し、全取得後にも同じ停止世代を検査する。 */
export class CaptureFrozenLeaveRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenLeaveRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CaptureLeaveRecordAdapter(this.c).prepare({
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
        return new Error("frozen leave capture changed")
    } catch (cause) {
      return new Error("frozen leave capture changed", { cause })
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
