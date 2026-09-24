import { ForbiddenError } from "@/lib/errors"
import { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { z } from "zod"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type {
  SystemAttachmentStorageContext,
  SystemClockContext,
} from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { expenseRecordKindSchema } from "@/contexts/expense/domain/schemas/expense-record-kind.schema"
import { PrepareExpensePreservationReadAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-preservation-read.adapter"
import { prepareSystemRecordSourceFreezeAuthorization } from "@system/interface/operations/prepare-system-record-source-freeze-authorization"
import { prepareSystemRecordKindCoverage } from "@system/interface/operations/prepare-system-record-kind-coverage"

const requestSchema = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  purpose: z.string().trim().min(1).max(255),
})
type Context = CompanyContext &
  SystemAttachmentStorageContext &
  SystemClockContext &
  Readonly<{ var: Readonly<{ bearerReadAuthentication?: SystemReadAuthentication }> }>

/** 現在の資格と全種別の照合終端を検査し、分割検証の計画と保存条件を準備する。 */
export class PrepareExpenseRetirementPlanAdapter {
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
    const authority = await prepareSystemRecordSourceFreezeAuthorization(this.c, {
      authentication,
      now: this.c.var.now(),
      stepUpToken,
    })
    if (authority instanceof Error) return authority
    if (authority === "forbidden")
      return new ForbiddenError("retirement authorization denied", "forbidden")
    const assertions = [...authority.assertions]
    const summaries = []
    const readers = []
    try {
      for (const recordKind of expenseRecordKindSchema.options) {
        const reader = await new PrepareExpensePreservationReadAdapter(this.c).prepare({
          authentication,
          at: this.c.var.now(),
          permission: recordKind === "expense-budget" ? "budget:manage" : "expense:read:all",
        })
        if (reader instanceof Error) return reader
        readers.push(reader)
        const chain = await prepareSystemRecordKindCoverage(
          {
            env: this.c.env,
            assertions: authority.assertions,
          },
          {
            freezeId: request.freezeId,
            sourceNamespace: request.sourceNamespace,
            purpose: request.purpose,
            ownerContext: "expense",
            recordKind,
          },
        )
        if (chain instanceof Error) return chain
        summaries.push(chain.summary)
        assertions.push(...chain.assertions)
      }
      for (const reader of readers) {
        const current = reader.assertions(this.c.var.now())
        if (current instanceof Error) return current
        assertions.push(...current)
      }
      const checked = await this.c.env.DB.batch(assertions)
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("retirement coverage changed")
      const plan = await RecordRetirementVerificationPlanEntity.create({
        ...request,
        ownerContext: "expense",
        capability: { revision: 1, recordKinds: expenseRecordKindSchema.options },
        coverage: summaries.map((summary) => ({
          recordKind: summary.recordKind,
          terminalPageId: summary.terminalPageId,
          terminalDigest: summary.terminalDigest,
          pageCount: summary.pageCount,
          recordCount: summary.recordCount,
        })),
        actorAccountId: authentication.accountId,
        createdAt: this.c.var.now().toISOString(),
        auditEventId: crypto.randomUUID(),
      })
      if (plan instanceof Error) return plan
      return Object.freeze({ plan, assertions: Object.freeze(assertions) })
    } catch (cause) {
      return new Error("retirement coverage unavailable", { cause })
    }
  }
}
