import { z } from "zod"
import type { GovernanceContext } from "@/contexts/governance/configuration/governance-context"
import { governanceRecordKindSchema } from "@/contexts/governance/domain/definitions/governance-record-kind.definition"
import { ListFrozenGovernanceRecordPageAdapter } from "@/contexts/governance/infrastructure/adapters/list-frozen-governance-record-page.adapter"
import { CaptureGovernanceRecordAdapter } from "@/contexts/governance/infrastructure/adapters/capture-governance-record.adapter"

type Context = GovernanceContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: governanceRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止した規程・ガバナンス台帳の原文を分割取得し、全取得後にも同じ停止世代を検査する。 */
export class CaptureFrozenGovernanceRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenGovernanceRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CaptureGovernanceRecordAdapter(this.c).prepare({
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
        return new Error("frozen governance capture changed")
    } catch (cause) {
      return new Error("frozen governance capture changed", { cause })
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
