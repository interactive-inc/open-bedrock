import { z } from "zod"
import type { CertificationContext } from "@/contexts/certification/configuration/certification-context"
import { certificationRecordKindSchema } from "@/contexts/certification/domain/certification-record-kind"
import { ListFrozenCertificationRecordPageAdapter } from "@/contexts/certification/infrastructure/adapters/list-frozen-certification-record-page.adapter"
import { CaptureCertificationRecordAdapter } from "@/contexts/certification/infrastructure/adapters/capture-certification-record.adapter"

type Context = CertificationContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(), sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: certificationRecordKindSchema, afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止した資格台帳の原文を分割取得し、全取得後にも同じ停止世代を検査する。 */
export class CaptureFrozenCertificationRecordPageAdapter {
  constructor(private readonly c: Context) { Object.freeze(this) }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenCertificationRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CaptureCertificationRecordAdapter(this.c).prepare({
        recordKind: request.recordKind, recordId, sourceNamespace: request.sourceNamespace,
      })
      if (record instanceof Error) return record
      records.push(record)
    }
    try {
      const checks = await this.c.env.DB.batch([...page.assertions])
      if (checks.length !== page.assertions.length || checks.some((check) => !check.success))
        return new Error("frozen certification capture changed")
    } catch (cause) {
      return new Error("frozen certification capture changed", { cause })
    }
    return Object.freeze({
      freezeId: page.freezeId, afterCursor: request.afterCursor, nextCursor: page.nextCursor,
      records: Object.freeze(records), assertions: page.assertions,
    })
  }
}
