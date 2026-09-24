import { PrepareBusinessTripRetirementPlanAdapter } from "@/contexts/business-trip/infrastructure/adapters/prepare-business-trip-retirement-plan.adapter"
import { BusinessTripRecordSystemAdapter } from "@/contexts/business-trip/infrastructure/adapters/business-trip-record-system.adapter"
import type { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { BusinessTripRetirementConflictError } from "@/contexts/business-trip/application/errors"

type Context = ConstructorParameters<typeof PrepareBusinessTripRetirementPlanAdapter>[0]

/** 出張申請記録の全照合ページを検査する計画を固定し、同一IDの再送で検査対象を増減させない。 */
export class CreateBusinessTripRetirementPlan {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown, stepUpToken: string) {
    const prepared = await new PrepareBusinessTripRetirementPlanAdapter(this.c).prepare(
      input,
      stepUpToken,
    )
    if (prepared instanceof Error) return prepared
    const plan = prepared.plan
    const repository = new BusinessTripRecordSystemAdapter({
      env: this.c.env,
      assertions: prepared.assertions,
    }).retirementPlans()
    const matches = (existing: RecordRetirementVerificationPlanEntity) =>
      existing.snapshot.freezeId === plan.snapshot.freezeId &&
      existing.snapshot.sourceNamespace === plan.snapshot.sourceNamespace &&
      existing.snapshot.ownerContext === plan.snapshot.ownerContext &&
      existing.snapshot.actorAccountId === plan.snapshot.actorAccountId &&
      existing.snapshot.purpose === plan.snapshot.purpose &&
      JSON.stringify(existing.snapshot.capability) === JSON.stringify(plan.snapshot.capability) &&
      JSON.stringify(existing.snapshot.coverage) === JSON.stringify(plan.snapshot.coverage)
    const existing = await repository.find(plan.snapshot.id)
    if (existing instanceof Error) return existing
    if (existing !== null)
      return matches(existing)
        ? existing
        : new BusinessTripRetirementConflictError("retirement plan replay differs")
    const saved = await repository.append(plan)
    if (saved instanceof Error) return saved
    if (saved === "written") return plan
    const raced = await repository.find(plan.snapshot.id)
    if (raced instanceof Error) return raced
    return raced !== null && matches(raced)
      ? raced
      : new BusinessTripRetirementConflictError("retirement plan creation conflicts")
  }
}
