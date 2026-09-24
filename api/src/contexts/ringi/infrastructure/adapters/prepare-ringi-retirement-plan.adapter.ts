import { ForbiddenError } from "@/lib/errors"
import type { RingiContext } from "@/contexts/ringi/configuration/ringi-context"
import { ringiRetirementPlanCommandSchema } from "@/contexts/ringi/domain/schemas/ringi-retirement-plan-command.schema"
import { RingiActorReadAdapter } from "@/contexts/ringi/infrastructure/adapters/ringi-actor-read.adapter"
import { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { prepareSystemRecordSourceFreezeAuthorization } from "@system/interface/operations/prepare-system-record-source-freeze-authorization"
import { prepareSystemRecordKindCoverage } from "@system/interface/operations/prepare-system-record-kind-coverage"
import { ringiRecordKinds } from "@/contexts/ringi/domain/definitions/ringi-record-kind.definition"

type Context = RingiContext

/** ringi記録の照合終端と現在の収集資格を検査し、撤去前の検証対象を固定する。 */
export class PrepareRingiRetirementPlanAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown, stepUpToken: string) {
    const parsed = ringiRetirementPlanCommandSchema.safeParse(input)
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
    const reader = await new RingiActorReadAdapter(this.c).prepare()
    if (reader instanceof Error) return reader
    const baseAssertions = [...authority.assertions, ...reader.assertions]
    const chains = []
    for (const recordKind of ringiRecordKinds) {
      const chain = await prepareSystemRecordKindCoverage(
        {
          env: this.c.env,
          assertions: baseAssertions,
        },
        {
          freezeId: request.freezeId,
          sourceNamespace: request.sourceNamespace,
          purpose: request.purpose,
          ownerContext: "ringi",
          recordKind,
        },
      )
      if (chain instanceof Error) return chain
      chains.push(chain)
    }
    const currentReader = await new RingiActorReadAdapter(this.c).prepare()
    if (currentReader instanceof Error) return currentReader
    const assertions = [...chains.flatMap((chain) => chain.assertions), ...currentReader.assertions]
    try {
      const checked = await this.c.env.DB.batch(assertions)
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("retirement coverage changed")
      const plan = await RecordRetirementVerificationPlanEntity.create({
        ...request,
        ownerContext: "ringi",
        capability: { revision: 1, recordKinds: ringiRecordKinds },
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
