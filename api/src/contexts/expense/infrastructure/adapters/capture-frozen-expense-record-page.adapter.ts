import { CaptureExpenseSourceAdapter } from "@/contexts/expense/infrastructure/adapters/capture-expense-source.adapter"
import { z } from "zod"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { SystemAttachmentStorageContext } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { ATTACHMENT_RECORD_MAX_SIZE } from "@system/domain/catalogs/records/attachment-record-format.catalog"
import { expenseRecordKindSchema } from "@/contexts/expense/domain/schemas/expense-record-kind.schema"
import { ListFrozenExpenseRecordPageAdapter } from "@/contexts/expense/infrastructure/adapters/list-frozen-expense-record-page.adapter"

type Context = CompanyContext & SystemAttachmentStorageContext & Readonly<{ now: () => Date }>
type Reader = Readonly<{
  authentication: SystemReadAuthentication
  session: CompanyPersonnelSession
}>
const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: expenseRecordKindSchema,
  afterCursor: z.string().min(1).max(512).nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止世代の本文を取得し、世代・各元記録・現在の閲覧資格を保存直前にも検査する。 */
export class CaptureFrozenExpenseRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown, reader: Reader) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    if (request.recordKind === "expense-attachment" && request.limit !== 1)
      return new Error("original attachment capture requires a single-record page")
    const page = await new ListFrozenExpenseRecordPageAdapter(this.c).prepare(request, reader)
    if (page instanceof Error) return page
    const records: Array<
      Exclude<Awaited<ReturnType<CaptureExpenseSourceAdapter["prepare"]>>, Error>
    > = []
    let contentByteLength = 0
    for (const entry of page.records) {
      const record = await new CaptureExpenseSourceAdapter(this.c).prepare(
        {
          recordKind: request.recordKind,
          recordId: entry.recordId,
          sourceNamespace: request.sourceNamespace,
        },
        reader,
      )
      if (record instanceof Error) return record
      if (
        record.source.props.recordId !== entry.recordId ||
        record.source.props.recordKind !== request.recordKind
      )
        return new Error("captured expense record does not match its inventory entry")
      contentByteLength += record.content.byteLength
      if (contentByteLength > ATTACHMENT_RECORD_MAX_SIZE)
        return new Error("expense capture page exceeds the content limit; use a smaller page")
      records.push(record)
    }
    const assertions = (now: Date) => {
      const current = page.assertions(now)
      if (current instanceof Error) return current
      return Object.freeze([...current, ...records.flatMap((record) => record.assertions)])
    }
    try {
      const guards = assertions(this.c.now())
      if (guards instanceof Error) return guards
      const checks = await this.c.env.DB.batch([...guards])
      if (checks.length !== guards.length || checks.some((check) => !check.success))
        return new Error("frozen expense capture changed")
    } catch (cause) {
      return new Error("frozen expense capture changed", { cause })
    }
    return Object.freeze({
      freezeId: page.freezeId,
      recordKind: request.recordKind,
      afterCursor: request.afterCursor,
      nextCursor: page.nextCursor,
      records: Object.freeze(records),
      contentByteLength,
      assertions,
    })
  }
}
