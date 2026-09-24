import { PrepareWorkAccidentRetirementPageAdapter } from "@/contexts/work-accident/infrastructure/adapters/prepare-work-accident-retirement-page.adapter"
import { WorkAccidentRecordSystemAdapter } from "@/contexts/work-accident/infrastructure/adapters/work-accident-record-system.adapter"
import { workAccidentRetirementVerificationCommandSchema } from "@/contexts/work-accident/domain/schemas/work-accident-retirement-verification-command.schema"
import {
  WorkAccidentRetirementForbiddenError,
  WorkAccidentRetirementConflictError,
} from "@/contexts/work-accident/application/errors"
import { RecordRetirementVerificationReceiptEntity } from "@system/domain/entities/record-retirement-verification-receipt.entity"

type Context = ConstructorParameters<typeof PrepareWorkAccidentRetirementPageAdapter>[0]

/** 労災・事故記録の保存済み計画の次ページを再検査し、再送でも現在の原記録と保持条件を要求する。 */
export class VerifyWorkAccidentRetirementPage {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    input: unknown,
    stepUpToken: string,
  ): Promise<RecordRetirementVerificationReceiptEntity | Error> {
    const parsed = workAccidentRetirementVerificationCommandSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const command = parsed.data
    const authentication = this.c.var.bearerReadAuthentication
    if (authentication === undefined)
      return new WorkAccidentRetirementForbiddenError("retirement authentication required")
    const authority = await new WorkAccidentRecordSystemAdapter(
      this.c,
    ).prepareSourceFreezeAuthorization({
      authentication,
      now: this.c.var.now(),
      stepUpToken,
    })
    if (authority instanceof Error) return authority
    if (authority === "forbidden")
      return new WorkAccidentRetirementForbiddenError("retirement authorization denied")
    const context = { env: this.c.env, assertions: authority.assertions }
    const plan = await new WorkAccidentRecordSystemAdapter(context)
      .retirementPlans()
      .find(command.planId)
    if (plan instanceof Error) return plan
    if (
      plan === null ||
      plan.snapshot.sourceNamespace !== command.sourceNamespace ||
      plan.snapshot.ownerContext !== "work-accident" ||
      plan.snapshot.capability.revision !== 1 ||
      JSON.stringify(plan.snapshot.capability.recordKinds) !==
        JSON.stringify(["work-accident-record"])
    )
      return new WorkAccidentRetirementConflictError(
        "retirement plan unavailable or capability changed",
      )
    const repository = new WorkAccidentRecordSystemAdapter(context).retirementReceipts()
    const existing = await repository.find(command.id)
    if (existing instanceof Error) return existing
    if (
      existing !== null &&
      (existing.snapshot.planId !== plan.snapshot.id ||
        existing.snapshot.actorAccountId !== authority.actorAccountId)
    )
      return new WorkAccidentRetirementConflictError("retirement receipt replay differs")
    const previous = await repository.findLatest(plan.snapshot.id)
    if (previous instanceof Error) return previous
    const ordinal = existing?.snapshot.ordinal ?? (previous?.snapshot.ordinal ?? 0) + 1
    const target = plan.target(ordinal)
    if (target instanceof Error)
      return new WorkAccidentRetirementConflictError("all plan pages already verified")
    const checked = await new PrepareWorkAccidentRetirementPageAdapter(this.c).prepare(
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
    const keys = await new WorkAccidentRecordSystemAdapter({
      env: this.c.env,
      assertions: checked.assertions,
    }).prepareRetirementPageKeys(checked.coveragePageId)
    if (keys instanceof Error) return keys
    const guardedContext = { env: this.c.env, assertions: keys.assertions }
    const guarded = new WorkAccidentRecordSystemAdapter(guardedContext).retirementReceipts()
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
        : new WorkAccidentRetirementConflictError("retirement receipt replay changed")
    }
    const page = await new WorkAccidentRecordSystemAdapter(guardedContext)
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
      : new WorkAccidentRetirementConflictError("retirement verification position already written")
  }
}
