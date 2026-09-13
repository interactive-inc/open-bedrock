import { ForbiddenError } from "@/lib/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { z } from "zod"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type {
  SystemAttachmentStorageContext,
  SystemClockContext,
} from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { expenseRecordKindSchema } from "@/contexts/expense/domain/schemas/expense-record-kind.schema"
import { PrepareExpensePreservationReadAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-preservation-read.adapter"
import { CaptureFrozenExpenseRecordPageAdapter } from "@/contexts/expense/infrastructure/adapters/capture-frozen-expense-record-page.adapter"
import { PrepareExpenseCoverageRecordsAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-coverage-records.adapter"
import { PrepareRecordSourceFreezeAuthorizationAdapter } from "@system/infrastructure/adapters/records/prepare-record-source-freeze-authorization.adapter"
import { PrepareRecordKindCoverageAdapter } from "@system/infrastructure/adapters/records/prepare-record-kind-coverage.adapter"
import { RecordCoveragePageRepository } from "@system/infrastructure/repositories/records/record-coverage-page.repository"

const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  purpose: z.string().trim().min(1).max(255),
  recordKind: expenseRecordKindSchema,
  sequence: z.number().int().positive().safe(),
  terminalDigest: z.string().regex(/^[0-9a-f]{64}$/),
})
type Context = CompanyContext &
  SystemAttachmentStorageContext &
  SystemClockContext &
  Readonly<{ var: Readonly<{ bearerReadAuthentication?: SystemReadAuthentication }> }>

/** 指定した照合ページの元記録・保全本文・保持条件を再検査し、分割検証の保存条件を渡す。 */
export class PrepareExpenseRetirementPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown, stepUpToken: string) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const authentication = this.c.var.bearerReadAuthentication
    if (authentication === undefined)
      return new ForbiddenError("retirement authentication required", "forbidden")
    const authority = await new PrepareRecordSourceFreezeAuthorizationAdapter(this.c).prepare({
      authentication,
      now: this.c.var.now(),
      stepUpToken,
    })
    if (authority instanceof Error) return authority
    if (authority === "forbidden")
      return new ForbiddenError("retirement authorization denied", "forbidden")
    const recordKind = request.recordKind
    const reader = await new PrepareExpensePreservationReadAdapter(this.c).prepare({
      authentication,
      at: this.c.var.now(),
      permission: recordKind === "expense-budget" ? "budget:manage" : "expense:read:all",
    })
    if (reader instanceof Error) return reader
    try {
      const chain = await new PrepareRecordKindCoverageAdapter({
        env: this.c.env,
        assertions: authority.assertions,
      }).prepare({
        freezeId: request.freezeId,
        sourceNamespace: request.sourceNamespace,
        purpose: request.purpose,
        ownerContext: "expense",
        recordKind,
      })
      if (chain instanceof Error) return chain
      if (chain.summary.terminalDigest !== request.terminalDigest)
        return new Error("coverage terminal changed")
      if (request.sequence > chain.summary.pageCount)
        return new Error("coverage page is outside the verified chain")
      const repository = new RecordCoveragePageRepository({
        env: this.c.env,
        assertions: chain.assertions,
      })
      const stored = await repository.find({
        freezeId: request.freezeId,
        recordKind,
        sequence: request.sequence,
      })
      if (stored instanceof Error) return stored
      if (stored === null) return new Error("coverage page disappeared")
      const captured = await new CaptureFrozenExpenseRecordPageAdapter({
        env: this.c.env,
        var: this.c.var,
        now: this.c.var.now,
      }).prepare(
        {
          freezeId: request.freezeId,
          sourceNamespace: request.sourceNamespace,
          recordKind,
          afterCursor: stored.snapshot.afterCursor,
          limit: recordKind === "expense-attachment" ? 1 : 10,
        },
        { authentication, session: reader.session },
      )
      if (captured instanceof Error) return captured
      if (captured.nextCursor !== stored.snapshot.nextCursor)
        return new Error("source inventory changed")
      const mappings = []
      for (const record of stored.snapshot.records) {
        const source = PreservedRecordSourceValue.create(record.source)
        if (source instanceof Error) return source
        mappings.push({
          sourceRecordId: source.props.recordId,
          preservedRecordId: record.preservedRecordId,
        })
      }
      const verified = await new PrepareExpenseCoverageRecordsAdapter({
        env: this.c.env,
        var: this.c.var,
        assertions: chain.assertions,
        sourceAssertions: () => captured.assertions(this.c.var.now()),
      }).prepare({ records: captured.records, mappings, purpose: request.purpose })
      if (verified instanceof Error) return verified
      const current = reader.assertions(this.c.var.now())
      if (current instanceof Error) return current
      const assertions = Object.freeze([...verified.assertions, ...current])
      const checked = await this.c.env.DB.batch([...assertions])
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("retirement page changed")
      return Object.freeze({
        ...request,
        coveragePageId: stored.snapshot.id,
        coveragePageDigest: stored.digest,
        nextSequence: request.sequence === chain.summary.pageCount ? null : request.sequence + 1,
        checkedAt: this.c.var.now().toISOString(),
        records: Object.freeze(verified.records),
        assertions,
      })
    } catch (cause) {
      return new Error("retirement coverage unavailable", { cause })
    }
  }
}
