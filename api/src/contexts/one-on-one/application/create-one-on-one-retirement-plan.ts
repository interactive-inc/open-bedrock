import { PrepareOneOnOneRetirementPlanAdapter } from "@/contexts/one-on-one/infrastructure/adapters/prepare-one-on-one-retirement-plan.adapter"
import { RecordRetirementVerificationPlanRepository } from "@system/infrastructure/repositories/records/record-retirement-verification-plan.repository"
import type { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { OneOnOneRetirementConflictError } from "@/contexts/one-on-one/application/errors"

type Context = ConstructorParameters<typeof PrepareOneOnOneRetirementPlanAdapter>[0]

/** 1on1記録の全照合ページを検査する計画を固定し、同一IDの再送で検査対象を増減させない。 */
export class CreateOneOnOneRetirementPlan {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown, stepUpToken: string) {
    const prepared = await new PrepareOneOnOneRetirementPlanAdapter(this.c).prepare(
      input,
      stepUpToken,
    )
    if (prepared instanceof Error) return prepared
    const plan = prepared.plan
    const repository = new RecordRetirementVerificationPlanRepository({
      env: this.c.env,
      assertions: prepared.assertions,
    })
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
        : new OneOnOneRetirementConflictError("retirement plan replay differs")
    const saved = await repository.append(plan)
    if (saved instanceof Error) return saved
    if (saved === "written") return plan
    const raced = await repository.find(plan.snapshot.id)
    if (raced instanceof Error) return raced
    return raced !== null && matches(raced)
      ? raced
      : new OneOnOneRetirementConflictError("retirement plan creation conflicts")
  }
}
