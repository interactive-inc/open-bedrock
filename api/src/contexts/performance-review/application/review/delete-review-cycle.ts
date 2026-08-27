import type { Session } from "@/lib/auth/session"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review/review-cycle.repository"
import type { ReviewCycle } from "@/contexts/performance-review/domain/entities/review-cycle.entity"

export type Input = {
  session: Session
  cycleId: number
}

export type Deleted = { reason: "deleted" }

/**
 * 管理権限のある本人が、評価サイクルを削除する。
 * draft 状態のサイクルのみ削除を許可する。
 */
export class DeleteReviewCycle {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(input: Input): Promise<Deleted | ApplicationError> {
    if (input.session.hasPermission("review:administer") === false) {
      return new ForbiddenError("cannot manage review cycles", "forbidden")
    }

    const repository = new ReviewCycleRepository(this.c)

    const reviewCycle: ReviewCycle | null | Error = await repository.findById(input.cycleId)

    if (reviewCycle instanceof Error) {
      return new UnexpectedError("failed to find review cycle", { cause: reviewCycle })
    }

    if (reviewCycle === null) {
      return new NotFoundError("review cycle not found", "cycle_not_found")
    }

    if (!reviewCycle.isDeletable) {
      return new ConflictError("review cycle is not deletable", "not_deletable")
    }

    const deleted = await repository.deleteWithForms(reviewCycle)

    if (deleted instanceof ConflictError) {
      return deleted
    }

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete review cycle", { cause: deleted })
    }

    return { reason: "deleted" }
  }
}
