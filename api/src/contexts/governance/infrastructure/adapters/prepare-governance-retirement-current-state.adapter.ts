import { z } from "zod"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { GovernanceContext } from "@/contexts/governance/configuration/governance-context"
import type {
  SystemAttachmentStorageContext,
  SystemClockContext,
} from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { GovernanceActorReadAdapter } from "@/contexts/governance/infrastructure/adapters/governance-actor-read.adapter"
import { PrepareRecordSourceFreezeAuthorizationAdapter } from "@system/infrastructure/adapters/records/prepare-record-source-freeze-authorization.adapter"
import { RecordRetirementVerificationPlanRepository } from "@system/infrastructure/repositories/records/record-retirement-verification-plan.repository"
import { PrepareRecordRetirementRetentionAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-retention.adapter"
import { PrepareRecordRetirementDisclosureAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-disclosure.adapter"
import { PrepareRecordRetirementSourceAttachmentsAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-source-attachments.adapter"
import { PrepareRecordRetirementStorageKeysAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-storage-keys.adapter"
import { ForbiddenError } from "@/lib/errors"
import { governanceRecordKinds } from "@/contexts/governance/domain/definitions/governance-record-kind.definition"

const requestSchema = z.strictObject({
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
})
type Context = GovernanceContext &
  CompanyContext &
  SystemAttachmentStorageContext &
  SystemClockContext &
  Readonly<{ var: Readonly<{ bearerReadAuthentication?: SystemReadAuthentication }> }>

/** 分割検査の全件完了と現在の保全条件を確認し、後続の確定処理に必要な条件を渡す。撤去許可は発行しない。 */
export class PrepareGovernanceRetirementCurrentStateAdapter {
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
    const context = { env: this.c.env, assertions: authority.assertions }
    const plan = await new RecordRetirementVerificationPlanRepository(context).find(request.planId)
    if (plan instanceof Error) return plan
    if (
      plan === null ||
      plan.digest !== request.planDigest ||
      plan.snapshot.sourceNamespace !== request.sourceNamespace ||
      plan.snapshot.ownerContext !== "governance" ||
      plan.snapshot.capability.revision !== 1 ||
      JSON.stringify(plan.snapshot.capability.recordKinds) !== JSON.stringify(governanceRecordKinds)
    )
      return new Error("retirement plan or source capability differs")
    const target = { planId: plan.snapshot.id, planDigest: plan.digest }
    const retention = await new PrepareRecordRetirementRetentionAdapter(context).prepare(
      target,
      this.c.var.now(),
    )
    if (retention instanceof Error) return retention
    const disclosure = await new PrepareRecordRetirementDisclosureAdapter({
      ...context,
      now: this.c.var.now,
    }).prepare(target, authentication)
    if (disclosure instanceof Error) return disclosure
    const originals = await new PrepareRecordRetirementSourceAttachmentsAdapter(context).prepare(
      target,
    )
    if (originals instanceof Error) return originals
    const keys = await new PrepareRecordRetirementStorageKeysAdapter(context).prepare(target)
    if (keys instanceof Error) return keys
    const assertions = [
      ...retention.assertions,
      ...disclosure.assertions,
      ...originals.assertions,
      ...keys.assertions,
    ]
    const reader = await new GovernanceActorReadAdapter(this.c).prepare()
    if (reader instanceof Error) return reader
    assertions.push(...reader.assertions)
    try {
      const checked = await this.c.env.DB.batch(assertions)
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("retirement current state changed")
      return Object.freeze({
        plan,
        freezeId: plan.snapshot.freezeId,
        sourceNamespace: plan.snapshot.sourceNamespace,
        ownerContext: plan.snapshot.ownerContext,
        purpose: plan.snapshot.purpose,
        capabilityRevision: plan.snapshot.capability.revision,
        kinds: plan.snapshot.coverage,
        terminalReceiptId: retention.coverage.terminalReceiptId,
        terminalReceiptDigest: retention.coverage.terminalReceiptDigest,
        checkedAt: this.c.var.now().toISOString(),
        assertions: Object.freeze(assertions),
      })
    } catch (cause) {
      return new Error("retirement current state unavailable", { cause })
    }
  }
}
