import type { Session } from "@/contexts/company/domain/iam/session"
import type { Context } from "@/env"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/review/review-cycle-repository"
import { ReviewFormRepository } from "@/contexts/performance-review/infrastructure/review/review-form-repository"

export type Input = {
  session: Session
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
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<DiscloseResult | ApplicationError> {
    if (input.session.hasPermission("review:administer") === false) {
      return new ForbiddenError("cannot manage review cycles", "forbidden")
    }

    const cycle = await new ReviewCycleRepository(this.c).findById(input.cycleId)

    if (cycle instanceof Error) {
      return new UnexpectedError("failed to find review cycle", { cause: cycle })
    }

    if (cycle === null) {
      return new NotFoundError("review cycle not found", "cycle_not_found")
    }

    const disclosedCount = await new ReviewFormRepository(this.c).discloseByCycleId(input.cycleId)

    if (disclosedCount instanceof Error) {
      return new UnexpectedError("failed to disclose review forms", { cause: disclosedCount })
    }

    return { cycleId: input.cycleId, disclosedCount }
  }
}
