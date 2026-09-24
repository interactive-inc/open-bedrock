import { PrepareItIncidentRetirementPageAdapter } from "@/contexts/it-incident/infrastructure/adapters/prepare-it-incident-retirement-page.adapter"
import { ItIncidentRecordSystemAdapter } from "@/contexts/it-incident/infrastructure/adapters/it-incident-record-system.adapter"
import { itIncidentRetirementVerificationCommandSchema } from "@/contexts/it-incident/domain/schemas/it-incident-retirement-verification-command.schema"
import {
  ItIncidentRetirementForbiddenError,
  ItIncidentRetirementConflictError,
} from "@/contexts/it-incident/application/errors"
import { RecordRetirementVerificationReceiptEntity } from "@system/domain/entities/record-retirement-verification-receipt.entity"

type Context = ConstructorParameters<typeof PrepareItIncidentRetirementPageAdapter>[0]

/** ITインシデント記録の保存済み計画の次ページを再検査し、再送でも現在の原記録と保持条件を要求する。 */
export class VerifyItIncidentRetirementPage {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    input: unknown,
    stepUpToken: string,
  ): Promise<RecordRetirementVerificationReceiptEntity | Error> {
    const parsed = itIncidentRetirementVerificationCommandSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const command = parsed.data
    const authentication = this.c.var.bearerReadAuthentication
    if (authentication === undefined)
      return new ItIncidentRetirementForbiddenError("retirement authentication required")
    const authority = await new ItIncidentRecordSystemAdapter(
      this.c,
    ).prepareSourceFreezeAuthorization({
      authentication,
      now: this.c.var.now(),
      stepUpToken,
    })
    if (authority instanceof Error) return authority
    if (authority === "forbidden")
      return new ItIncidentRetirementForbiddenError("retirement authorization denied")
    const context = { env: this.c.env, assertions: authority.assertions }
    const plan = await new ItIncidentRecordSystemAdapter(context)
      .retirementPlans()
      .find(command.planId)
    if (plan instanceof Error) return plan
    if (
      plan === null ||
      plan.snapshot.sourceNamespace !== command.sourceNamespace ||
      plan.snapshot.ownerContext !== "it-incident" ||
      plan.snapshot.capability.revision !== 1 ||
      JSON.stringify(plan.snapshot.capability.recordKinds) !==
        JSON.stringify(["it-incident-record"])
    )
      return new ItIncidentRetirementConflictError(
        "retirement plan unavailable or capability changed",
      )
    const repository = new ItIncidentRecordSystemAdapter(context).retirementReceipts()
    const existing = await repository.find(command.id)
    if (existing instanceof Error) return existing
    if (
      existing !== null &&
      (existing.snapshot.planId !== plan.snapshot.id ||
        existing.snapshot.actorAccountId !== authority.actorAccountId)
    )
      return new ItIncidentRetirementConflictError("retirement receipt replay differs")
    const previous = await repository.findLatest(plan.snapshot.id)
    if (previous instanceof Error) return previous
    const ordinal = existing?.snapshot.ordinal ?? (previous?.snapshot.ordinal ?? 0) + 1
    const target = plan.target(ordinal)
    if (target instanceof Error)
      return new ItIncidentRetirementConflictError("all plan pages already verified")
    const checked = await new PrepareItIncidentRetirementPageAdapter(this.c).prepare(
      {
        freezeId: target.freezeId,
        sourceNamespace: target.sourceNamespace,
        purpose: target.purpose,
        recordKind: target.recordKind,
        sequence: target.sequence,
        terminalDigest: target.terminalDigest,
      },
      stepUpToken,
    )
    if (checked instanceof Error) return checked
    const keys = await new ItIncidentRecordSystemAdapter({
      env: this.c.env,
      assertions: checked.assertions,
    }).prepareRetirementPageKeys(checked.coveragePageId)
    if (keys instanceof Error) return keys
    const guardedContext = { env: this.c.env, assertions: keys.assertions }
    const guarded = new ItIncidentRecordSystemAdapter(guardedContext).retirementReceipts()
    const matches = (receipt: RecordRetirementVerificationReceiptEntity) =>
      receipt.snapshot.planId === plan.snapshot.id &&
      receipt.snapshot.planDigest === plan.digest &&
      receipt.snapshot.ordinal === ordinal &&
      receipt.snapshot.actorAccountId === authority.actorAccountId &&
      receipt.snapshot.coveragePageId === checked.coveragePageId &&
      receipt.snapshot.coveragePageDigest === checked.coveragePageDigest &&
      JSON.stringify(receipt.snapshot.storageKeys) === JSON.stringify(keys.storageKeys)
    if (existing !== null) {
      const current = await guarded.find(command.id)
      if (current instanceof Error) return current
      return current !== null && matches(current)
        ? current
        : new ItIncidentRetirementConflictError("retirement receipt replay changed")
    }
    const page = await new ItIncidentRecordSystemAdapter(guardedContext)
      .coveragePages()
      .find(checked.coveragePageId)
    if (page instanceof Error) return page
    if (page === null) return new Error("retirement coverage page missing")
    const receipt = await RecordRetirementVerificationReceiptEntity.create(
      {
        id: command.id,
        planId: plan.snapshot.id,
        planDigest: plan.digest,
        ordinal,
        coveragePageId: page.snapshot.id,
        coveragePageDigest: page.digest,
        previousReceiptDigest: previous?.digest ?? null,
        storageKeys: keys.storageKeys,
        actorAccountId: authority.actorAccountId,
        checkedAt: checked.checkedAt,
        auditEventId: crypto.randomUUID(),
      },
      { plan, page, previous },
    )
    if (receipt instanceof Error) return receipt
    const saved = await guarded.append(receipt)
    if (saved instanceof Error) return saved
    if (saved === "written") return receipt
    const raced = await guarded.find(command.id)
    if (raced instanceof Error) return raced
    return raced !== null && matches(raced)
      ? raced
      : new ItIncidentRetirementConflictError("retirement verification position already written")
  }
}
