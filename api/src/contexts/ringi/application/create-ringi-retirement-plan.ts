import { PrepareRingiRetirementPlanAdapter } from "@/contexts/ringi/infrastructure/adapters/prepare-ringi-retirement-plan.adapter"
import { RingiRecordSystemAdapter } from "@/contexts/ringi/infrastructure/adapters/ringi-record-system.adapter"
import type { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { RingiRetirementConflictError } from "@/contexts/ringi/application/errors"

type Context = ConstructorParameters<typeof PrepareRingiRetirementPlanAdapter>[0]

/** ringi記録の全照合ページを検査する計画を固定し、同一IDの再送で検査対象を増減させない。 */
export class CreateRingiRetirementPlan {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown, stepUpToken: string) {
    const prepared = await new PrepareRingiRetirementPlanAdapter(this.c).prepare(input, stepUpToken)
    if (prepared instanceof Error) return prepared
    const plan = prepared.plan
    const repository = new RingiRecordSystemAdapter({
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
        : new RingiRetirementConflictError("retirement plan replay differs")
    const saved = await repository.append(plan)
    if (saved instanceof Error) return saved
    if (saved === "written") return plan
    const raced = await repository.find(plan.snapshot.id)
    if (raced instanceof Error) return raced
    return raced !== null && matches(raced)
      ? raced
      : new RingiRetirementConflictError("retirement plan creation conflicts")
  }
}
