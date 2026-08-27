import type { Session } from "@/lib/auth/session"
import type { ReviewCycle } from "@/contexts/performance-review/domain/entities/review-cycle.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review/review-cycle.repository"
import { ReviewCyclePolicyAdapter } from "@/contexts/performance-review/infrastructure/adapters/review/review-cycle-policy.adapter"
import { ReviewFormGenerationAdapter } from "@/contexts/performance-review/infrastructure/adapters/review/review-form-generation.adapter"

export type Input = {
  session: Session
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

    const repository = new ReviewCycleRepository(this.c)

    const reviewCycle = await repository.findById(input.cycleId)

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
      const policy = await new ReviewCyclePolicyAdapter(this.c).find(reviewCycle.id)

      if (policy instanceof Error) {
        return new UnexpectedError("failed to load review cycle policy", { cause: policy })
      }

      const generated = await new ReviewFormGenerationAdapter(this.c).generate({
        cycleId: reviewCycle.id,
        policy,
      })

      if (generated instanceof Error) {
        return new UnexpectedError("failed to generate review forms", { cause: generated })
      }
    }

    const updated = await repository.updateStatus(transitioned, previousStatus)

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update review cycle", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError("invalid review cycle transition", "invalid_transition")
    }

    return updated
  }
}
