import { PrepareDisciplinaryActionRetirementPageAdapter } from "@/contexts/disciplinary-action/infrastructure/adapters/prepare-disciplinary-action-retirement-page.adapter"
import { DisciplinaryActionRecordSystemAdapter } from "@/contexts/disciplinary-action/infrastructure/adapters/disciplinary-action-record-system.adapter"
import { disciplinaryActionRetirementVerificationCommandSchema } from "@/contexts/disciplinary-action/domain/schemas/disciplinary-action-retirement-verification-command.schema"
import {
  DisciplinaryActionRetirementForbiddenError,
  DisciplinaryActionRetirementConflictError,
} from "@/contexts/disciplinary-action/application/errors"
import { RecordRetirementVerificationReceiptEntity } from "@system/domain/entities/record-retirement-verification-receipt.entity"

type Context = ConstructorParameters<typeof PrepareDisciplinaryActionRetirementPageAdapter>[0]

/** 懲戒記録の保存済み計画の次ページを再検査し、再送でも現在の原記録と保持条件を要求する。 */
export class VerifyDisciplinaryActionRetirementPage {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    input: unknown,
    stepUpToken: string,
  ): Promise<RecordRetirementVerificationReceiptEntity | Error> {
    const parsed = disciplinaryActionRetirementVerificationCommandSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const command = parsed.data
    const authentication = this.c.var.bearerReadAuthentication
    if (authentication === undefined)
      return new DisciplinaryActionRetirementForbiddenError("retirement authentication required")
    const authority = await new DisciplinaryActionRecordSystemAdapter(
      this.c,
    ).prepareSourceFreezeAuthorization({
      authentication,
      now: this.c.var.now(),
      stepUpToken,
    })
    if (authority instanceof Error) return authority
    if (authority === "forbidden")
      return new DisciplinaryActionRetirementForbiddenError("retirement authorization denied")
    const context = { env: this.c.env, assertions: authority.assertions }
    const plan = await new DisciplinaryActionRecordSystemAdapter(context)
      .retirementPlans()
      .find(command.planId)
    if (plan instanceof Error) return plan
    if (
      plan === null ||
      plan.snapshot.sourceNamespace !== command.sourceNamespace ||
      plan.snapshot.ownerContext !== "disciplinary-action" ||
      plan.snapshot.capability.revision !== 1 ||
      JSON.stringify(plan.snapshot.capability.recordKinds) !==
        JSON.stringify(["disciplinary-action-record"])
    )
      return new DisciplinaryActionRetirementConflictError(
        "retirement plan unavailable or capability changed",
      )
    const repository = new DisciplinaryActionRecordSystemAdapter(context).retirementReceipts()
    const existing = await repository.find(command.id)
    if (existing instanceof Error) return existing
    if (
      existing !== null &&
      (existing.snapshot.planId !== plan.snapshot.id ||
        existing.snapshot.actorAccountId !== authority.actorAccountId)
    )
      return new DisciplinaryActionRetirementConflictError("retirement receipt replay differs")
    const previous = await repository.findLatest(plan.snapshot.id)
    if (previous instanceof Error) return previous
    const ordinal = existing?.snapshot.ordinal ?? (previous?.snapshot.ordinal ?? 0) + 1
    const target = plan.target(ordinal)
    if (target instanceof Error)
      return new DisciplinaryActionRetirementConflictError("all plan pages already verified")
    const checked = await new PrepareDisciplinaryActionRetirementPageAdapter(this.c).prepare(
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
    const keys = await new DisciplinaryActionRecordSystemAdapter({
      env: this.c.env,
      assertions: checked.assertions,
    }).prepareRetirementPageKeys(checked.coveragePageId)
    if (keys instanceof Error) return keys
    const guardedContext = { env: this.c.env, assertions: keys.assertions }
    const guarded = new DisciplinaryActionRecordSystemAdapter(guardedContext).retirementReceipts()
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
        : new DisciplinaryActionRetirementConflictError("retirement receipt replay changed")
    }
    const page = await new DisciplinaryActionRecordSystemAdapter(guardedContext)
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
      : new DisciplinaryActionRetirementConflictError(
          "retirement verification position already written",
        )
  }
}
