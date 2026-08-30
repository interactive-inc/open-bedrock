import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { Context } from "@/env"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review/review-cycle.repository"
import { ReviewFormRepository } from "@/contexts/performance-review/infrastructure/repositories/review/review-form.repository"
import type { ReviewCycle } from "@/contexts/performance-review/domain/entities/review-cycle.entity"

export type Input = {
  session: CompanySessionValue
  cycleId: number
}

export type DiscloseResult = {
  cycleId: number
  disclosedCount: number
}

/**
 * 管理権限のある本人が、サイクル内の全評価フォームを一括で本人開示（disclosed）にする。
 */
export class DiscloseReviewCycle {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(input: Input): Promise<DiscloseResult | ApplicationError> {
    if (input.session.hasPermission("review:administer") === false) {
      return new ForbiddenError("cannot manage review cycles", "forbidden")
    }

    const cycle: ReviewCycle | null | Error = await new ReviewCycleRepository(this.c).findById(
      input.cycleId,
    )

    if (cycle instanceof Error) {
      return new UnexpectedError("failed to find review cycle", { cause: cycle })
    }

    if (cycle === null) {
      return new NotFoundError("review cycle not found", "cycle_not_found")
    }

    const disclosedCount = await new ReviewFormRepository(this.c).discloseByCycle(cycle)

    if (disclosedCount instanceof Error) {
      return new UnexpectedError("failed to disclose review forms", { cause: disclosedCount })
    }

    return { cycleId: input.cycleId, disclosedCount }
  }
}
