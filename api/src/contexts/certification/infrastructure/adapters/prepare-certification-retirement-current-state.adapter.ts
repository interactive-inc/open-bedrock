import { z } from "zod"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CertificationContext } from "@/contexts/certification/configuration/certification-context"
import type {
  SystemAttachmentStorageContext,
  SystemClockContext,
} from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { CertificationActorReadAdapter } from "@/contexts/certification/infrastructure/adapters/certification-actor-read.adapter"
import { prepareSystemRecordSourceFreezeAuthorization } from "@system/interface/operations/prepare-system-record-source-freeze-authorization"
import { openSystemRecordRetirementVerificationPlans } from "@system/interface/operations/open-system-record-retirement-verification-plans"
import { prepareSystemRecordRetirementRetention } from "@system/interface/operations/prepare-system-record-retirement-retention"
import { prepareSystemRecordRetirementDisclosure } from "@system/interface/operations/prepare-system-record-retirement-disclosure"
import { prepareSystemRecordRetirementSourceAttachments } from "@system/interface/operations/prepare-system-record-retirement-source-attachments"
import { prepareSystemRecordRetirementStorageKeys } from "@system/interface/operations/prepare-system-record-retirement-storage-keys"
import { ForbiddenError } from "@/lib/errors"
import { certificationRecordKinds } from "@/contexts/certification/domain/definitions/certification-record-kind.definition"

const requestSchema = z.strictObject({
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
})
type Context = CertificationContext &
  CompanyContext &
  SystemAttachmentStorageContext &
  SystemClockContext &
  Readonly<{ var: Readonly<{ bearerReadAuthentication?: SystemReadAuthentication }> }>

/** 分割検査の全件完了と現在の保全条件を確認し、後続の確定処理に必要な条件を渡す。撤去許可は発行しない。 */
export class PrepareCertificationRetirementCurrentStateAdapter {
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
    const context = { env: this.c.env, assertions: authority.assertions }
    const plan = await openSystemRecordRetirementVerificationPlans(context).find(request.planId)
    if (plan instanceof Error) return plan
    if (
      plan === null ||
      plan.digest !== request.planDigest ||
      plan.snapshot.sourceNamespace !== request.sourceNamespace ||
      plan.snapshot.ownerContext !== "certification" ||
      plan.snapshot.capability.revision !== 1 ||
      JSON.stringify(plan.snapshot.capability.recordKinds) !==
        JSON.stringify(certificationRecordKinds)
    )
      return new Error("retirement plan or source capability differs")
    const target = { planId: plan.snapshot.id, planDigest: plan.digest }
    const retention = await prepareSystemRecordRetirementRetention(
      context,
      target,
      this.c.var.now(),
    )
    if (retention instanceof Error) return retention
    const disclosure = await prepareSystemRecordRetirementDisclosure(
      {
        ...context,
        now: this.c.var.now,
      },
      target,
      authentication,
    )
    if (disclosure instanceof Error) return disclosure
    const originals = await prepareSystemRecordRetirementSourceAttachments(context, target)
    if (originals instanceof Error) return originals
    const keys = await prepareSystemRecordRetirementStorageKeys(context, target)
    if (keys instanceof Error) return keys
    const assertions = [
      ...retention.assertions,
      ...disclosure.assertions,
      ...originals.assertions,
      ...keys.assertions,
    ]
    const reader = await new CertificationActorReadAdapter(this.c).prepare()
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
