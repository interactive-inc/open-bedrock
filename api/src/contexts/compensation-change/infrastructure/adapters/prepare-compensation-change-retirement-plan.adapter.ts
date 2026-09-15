import { ForbiddenError } from "@/lib/errors"
import type { CompensationChangeContext } from "@/contexts/compensation-change/configuration/compensation-change-context"
import { compensationChangeRetirementPlanCommandSchema } from "@/contexts/compensation-change/domain/schemas/compensation-change-retirement-plan-command.schema"
import { CompensationChangeActorReadAdapter } from "@/contexts/compensation-change/infrastructure/adapters/compensation-change-actor-read.adapter"
import { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { PrepareRecordSourceFreezeAuthorizationAdapter } from "@system/infrastructure/adapters/records/prepare-record-source-freeze-authorization.adapter"
import { PrepareRecordKindCoverageAdapter } from "@system/infrastructure/adapters/records/prepare-record-kind-coverage.adapter"
import { compensationChangeRecordKinds } from "@/contexts/compensation-change/domain/definitions/compensation-change-record-kind.definition"

type Context = CompensationChangeContext

/** compensation-change記録の照合終端と現在の収集資格を検査し、撤去前の検証対象を固定する。 */
export class PrepareCompensationChangeRetirementPlanAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown, stepUpToken: string) {
    const parsed = compensationChangeRetirementPlanCommandSchema.safeParse(input)
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
    const reader = await new CompensationChangeActorReadAdapter(this.c).prepare()
    if (reader instanceof Error) return reader
    const baseAssertions = [...authority.assertions, ...reader.assertions]
    const chains = []
    for (const recordKind of compensationChangeRecordKinds) {
      const chain = await new PrepareRecordKindCoverageAdapter({
        env: this.c.env,
        assertions: baseAssertions,
      }).prepare({
        freezeId: request.freezeId,
        sourceNamespace: request.sourceNamespace,
        purpose: request.purpose,
        ownerContext: "compensation-change",
        recordKind,
      })
      if (chain instanceof Error) return chain
      chains.push(chain)
    }
    const currentReader = await new CompensationChangeActorReadAdapter(this.c).prepare()
    if (currentReader instanceof Error) return currentReader
    const assertions = [...chains.flatMap((chain) => chain.assertions), ...currentReader.assertions]
    try {
      const checked = await this.c.env.DB.batch(assertions)
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("retirement coverage changed")
      const plan = await RecordRetirementVerificationPlanEntity.create({
        ...request,
        ownerContext: "compensation-change",
        capability: { revision: 1, recordKinds: compensationChangeRecordKinds },
        coverage: chains.map(({ summary }) => ({
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
