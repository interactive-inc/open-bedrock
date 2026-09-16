import { z } from "zod"
import type { OnboardingContext } from "@/contexts/onboarding/configuration/onboarding-context"
import { onboardingRecordKindSchema } from "@/contexts/onboarding/domain/definitions/onboarding-record-kind.definition"
import { ListFrozenOnboardingRecordPageAdapter } from "@/contexts/onboarding/infrastructure/adapters/list-frozen-onboarding-record-page.adapter"
import { CaptureOnboardingRecordAdapter } from "@/contexts/onboarding/infrastructure/adapters/capture-onboarding-record.adapter"

type Context = OnboardingContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: onboardingRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止した入退社手続き台帳の原文を分割取得し、全取得後にも同じ停止世代を検査する。 */
export class CaptureFrozenOnboardingRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenOnboardingRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CaptureOnboardingRecordAdapter(this.c).prepare({
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
        return new Error("frozen onboarding capture changed")
    } catch (cause) {
      return new Error("frozen onboarding capture changed", { cause })
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
