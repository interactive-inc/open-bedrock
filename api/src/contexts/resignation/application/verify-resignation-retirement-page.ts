import { PrepareResignationRetirementPageAdapter } from "@/contexts/resignation/infrastructure/adapters/prepare-resignation-retirement-page.adapter"
import { ResignationRecordSystemAdapter } from "@/contexts/resignation/infrastructure/adapters/resignation-record-system.adapter"
import { resignationRetirementVerificationCommandSchema } from "@/contexts/resignation/domain/schemas/resignation-retirement-verification-command.schema"
import {
  ResignationRetirementForbiddenError,
  ResignationRetirementConflictError,
} from "@/contexts/resignation/application/errors"
import { RecordRetirementVerificationReceiptEntity } from "@system/domain/entities/record-retirement-verification-receipt.entity"

type Context = ConstructorParameters<typeof PrepareResignationRetirementPageAdapter>[0]

/** resignation記録の保存済み計画の次ページを再検査し、再送でも現在の原記録と保持条件を要求する。 */
export class VerifyResignationRetirementPage {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    input: unknown,
    stepUpToken: string,
  ): Promise<RecordRetirementVerificationReceiptEntity | Error> {
    const parsed = resignationRetirementVerificationCommandSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const command = parsed.data
    const authentication = this.c.var.bearerReadAuthentication
    if (authentication === undefined)
      return new ResignationRetirementForbiddenError("retirement authentication required")
    const authority = await new ResignationRecordSystemAdapter(
      this.c,
    ).prepareSourceFreezeAuthorization({
      authentication,
      now: this.c.var.now(),
      stepUpToken,
    })
    if (authority instanceof Error) return authority
    if (authority === "forbidden")
      return new ResignationRetirementForbiddenError("retirement authorization denied")
    const context = { env: this.c.env, assertions: authority.assertions }
    const plan = await new ResignationRecordSystemAdapter(context)
      .retirementPlans()
      .find(command.planId)
    if (plan instanceof Error) return plan
    if (
      plan === null ||
      plan.snapshot.sourceNamespace !== command.sourceNamespace ||
      plan.snapshot.ownerContext !== "resignation" ||
      plan.snapshot.capability.revision !== 1 ||
      JSON.stringify(plan.snapshot.capability.recordKinds) !==
        JSON.stringify(["resignation-record"])
    )
      return new ResignationRetirementConflictError(
        "retirement plan unavailable or capability changed",
      )
    const repository = new ResignationRecordSystemAdapter(context).retirementReceipts()
    const existing = await repository.find(command.id)
    if (existing instanceof Error) return existing
    if (
      existing !== null &&
      (existing.snapshot.planId !== plan.snapshot.id ||
        existing.snapshot.actorAccountId !== authority.actorAccountId)
    )
      return new ResignationRetirementConflictError("retirement receipt replay differs")
    const previous = await repository.findLatest(plan.snapshot.id)
    if (previous instanceof Error) return previous
    const ordinal = existing?.snapshot.ordinal ?? (previous?.snapshot.ordinal ?? 0) + 1
    const target = plan.target(ordinal)
    if (target instanceof Error)
      return new ResignationRetirementConflictError("all plan pages already verified")
    const checked = await new PrepareResignationRetirementPageAdapter(this.c).prepare(
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
    const keys = await new ResignationRecordSystemAdapter({
      env: this.c.env,
      assertions: checked.assertions,
    }).prepareRetirementPageKeys(checked.coveragePageId)
    if (keys instanceof Error) return keys
    const guardedContext = { env: this.c.env, assertions: keys.assertions }
    const guarded = new ResignationRecordSystemAdapter(guardedContext).retirementReceipts()
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
        : new ResignationRetirementConflictError("retirement receipt replay changed")
    }
    const page = await new ResignationRecordSystemAdapter(guardedContext)
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
      : new ResignationRetirementConflictError("retirement verification position already written")
  }
}
