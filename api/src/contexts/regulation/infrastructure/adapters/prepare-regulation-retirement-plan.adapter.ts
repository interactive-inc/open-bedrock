import { ForbiddenError } from "@/lib/errors"
import type { RegulationContext } from "@/contexts/regulation/configuration/regulation-context"
import { regulationRetirementPlanCommandSchema } from "@/contexts/regulation/domain/schemas/regulation-retirement-plan-command.schema"
import { RegulationActorReadAdapter } from "@/contexts/regulation/infrastructure/adapters/regulation-actor-read.adapter"
import { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { PrepareRecordSourceFreezeAuthorizationAdapter } from "@system/infrastructure/adapters/records/prepare-record-source-freeze-authorization.adapter"
import { PrepareRecordKindCoverageAdapter } from "@system/infrastructure/adapters/records/prepare-record-kind-coverage.adapter"
import { regulationRecordKinds } from "@/contexts/regulation/domain/definitions/regulation-record-kind.definition"

type Context = RegulationContext

/** regulation記録の照合終端と現在の収集資格を検査し、撤去前の検証対象を固定する。 */
export class PrepareRegulationRetirementPlanAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown, stepUpToken: string) {
    const parsed = regulationRetirementPlanCommandSchema.safeParse(input)
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
    const reader = await new RegulationActorReadAdapter(this.c).prepare()
    if (reader instanceof Error) return reader
    const baseAssertions = [...authority.assertions, ...reader.assertions]
    const chains = []
    for (const recordKind of regulationRecordKinds) {
      const chain = await new PrepareRecordKindCoverageAdapter({
        env: this.c.env,
        assertions: baseAssertions,
      }).prepare({
        freezeId: request.freezeId,
        sourceNamespace: request.sourceNamespace,
        purpose: request.purpose,
        ownerContext: "regulation",
        recordKind,
      })
      if (chain instanceof Error) return chain
      chains.push(chain)
    }
    const currentReader = await new RegulationActorReadAdapter(this.c).prepare()
    if (currentReader instanceof Error) return currentReader
    const assertions = [...chains.flatMap((chain) => chain.assertions), ...currentReader.assertions]
    try {
      const checked = await this.c.env.DB.batch(assertions)
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("retirement coverage changed")
      const plan = await RecordRetirementVerificationPlanEntity.create({
        ...request,
        ownerContext: "regulation",
        capability: { revision: 1, recordKinds: regulationRecordKinds },
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
