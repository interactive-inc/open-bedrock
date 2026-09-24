import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { ReviewCycle } from "@/contexts/performance-review/domain/entities/review-cycle.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review/review-cycle.repository"

type Context = Readonly<{
  reviewCycleRepository: Pick<ReviewCycleRepository, "findById" | "updateStatus">
}>

export type Input = {
  session: CompanySessionValue
  cycleId: number
}

/** 評価サイクルを終了する。 */
export class CloseReviewCycle {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: Input): Promise<ReviewCycle | ApplicationError> {
    if (input.session.hasPermission("review:administer") === false) {
      return new ForbiddenError("cannot manage review cycles", "forbidden")
    }

    const reviewCycle = await this.c.reviewCycleRepository.findById(input.cycleId)

    if (reviewCycle instanceof Error) {
      return new UnexpectedError("failed to find review cycle", { cause: reviewCycle })
    }

    if (reviewCycle === null) {
      return new NotFoundError("review cycle not found", "cycle_not_found")
    }

    const previousStatus = reviewCycle.status

    const transitioned = reviewCycle.close()

    if (transitioned === null) {
      return new ConflictError("invalid review cycle transition", "invalid_transition")
    }
    const updated = await this.c.reviewCycleRepository.updateStatus(transitioned, previousStatus)

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update review cycle", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError("invalid review cycle transition", "invalid_transition")
    }

    return updated
  }
}
