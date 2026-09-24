import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { ReviewCycle } from "@/contexts/performance-review/domain/entities/review-cycle.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review/review-cycle.repository"
import type { ReviewCyclePolicyAdapter } from "@/contexts/performance-review/infrastructure/adapters/review/review-cycle-policy.adapter"
import type { ReviewFormGenerationAdapter } from "@/contexts/performance-review/infrastructure/adapters/review/review-form-generation.adapter"

type Context = Readonly<{
  reviewCycleRepository: Pick<ReviewCycleRepository, "findById" | "updateStatus">
  reviewCyclePolicyAdapter: Pick<ReviewCyclePolicyAdapter, "find">
  reviewFormGenerationAdapter: Pick<ReviewFormGenerationAdapter, "generate">
}>

export type Input = {
  session: CompanySessionValue
  cycleId: number
}

/** 評価サイクルを開始する。 */
export class OpenReviewCycle {
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

    const transitioned = reviewCycle.open()

    if (transitioned === null) {
      return new ConflictError("invalid review cycle transition", "invalid_transition")
    }

    if (reviewCycle.id !== null) {
      const policy = await this.c.reviewCyclePolicyAdapter.find(reviewCycle.id)

      if (policy instanceof Error) {
        return new UnexpectedError("failed to load review cycle policy", { cause: policy })
      }

      const generated = await this.c.reviewFormGenerationAdapter.generate({
        cycleId: reviewCycle.id,
        policy,
      })

      if (generated instanceof Error) {
        return new UnexpectedError("failed to generate review forms", { cause: generated })
      }
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
