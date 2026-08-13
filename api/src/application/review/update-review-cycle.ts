import type { Session } from "@/contexts/company/domain/iam/session"
import type { ReviewCycle } from "@/domain/review/review-cycle.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ReviewCycleRepository } from "@/infrastructure/review/review-cycle-repository"

export type Input = {
  session: Session
  cycleId: number
  title: string
  period: string
  dueDate: string | null
}

/**
 * 管理権限のある本人が、評価サイクルの題目・期間・締切を更新する。
 */
export class UpdateReviewCycle {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ReviewCycle | ApplicationError> {
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

    if (reviewCycle.status === "closed") {
      return new ConflictError("review cycle is not modifiable", "not_modifiable")
    }

    const updated = await repository.updateDetails(
      reviewCycle.withDetails({
        title: input.title,
        period: input.period,
        dueDate: input.dueDate,
      }),
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update review cycle", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError("review cycle is not editable", "not_editable")
    }

    return updated
  }
}
