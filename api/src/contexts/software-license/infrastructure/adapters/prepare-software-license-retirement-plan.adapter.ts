import { ForbiddenError } from "@/lib/errors"
import type { SoftwareLicenseContext } from "@/contexts/software-license/configuration/software-license-context"
import { softwareLicenseRetirementPlanCommandSchema } from "@/contexts/software-license/domain/schemas/software-license-retirement-plan-command.schema"
import { LicenseActorReadAdapter } from "@/contexts/software-license/infrastructure/adapters/license-actor-read.adapter"
import { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { PrepareRecordSourceFreezeAuthorizationAdapter } from "@system/infrastructure/adapters/records/prepare-record-source-freeze-authorization.adapter"
import { PrepareRecordKindCoverageAdapter } from "@system/infrastructure/adapters/records/prepare-record-kind-coverage.adapter"

type Context = SoftwareLicenseContext

/** サービス利用台帳の照合終端と現在の収集資格を検査し、撤去前の検証対象を固定する。 */
export class PrepareSoftwareLicenseRetirementPlanAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown, stepUpToken: string) {
    const parsed = softwareLicenseRetirementPlanCommandSchema.safeParse(input)
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
    const reader = await new LicenseActorReadAdapter(this.c).prepare()
    if (reader instanceof Error) return reader
    const chain = await new PrepareRecordKindCoverageAdapter({
      env: this.c.env,
      assertions: [...authority.assertions, ...reader.assertions],
    }).prepare({
      freezeId: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      purpose: request.purpose,
      ownerContext: "software-license",
      recordKind: "license-record",
    })
    if (chain instanceof Error) return chain
    const currentReader = await new LicenseActorReadAdapter(this.c).prepare()
    if (currentReader instanceof Error) return currentReader
    const assertions = [...chain.assertions, ...currentReader.assertions]
    try {
      const checked = await this.c.env.DB.batch(assertions)
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("retirement coverage changed")
      const summary = chain.summary
      const plan = await RecordRetirementVerificationPlanEntity.create({
        ...request,
        ownerContext: "software-license",
        capability: { revision: 1, recordKinds: ["license-record"] },
        coverage: [
          {
            recordKind: summary.recordKind,
            terminalPageId: summary.terminalPageId,
            terminalDigest: summary.terminalDigest,
            pageCount: summary.pageCount,
            recordCount: summary.recordCount,
          },
        ],
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
