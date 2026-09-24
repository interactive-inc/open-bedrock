import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { ReviewCycle } from "@/contexts/performance-review/domain/entities/review-cycle.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review/review-cycle.repository"

type Context = Readonly<{
  reviewCycleRepository: Pick<ReviewCycleRepository, "findById" | "updateDetails">
}>

export type Input = {
  session: CompanySessionValue
  cycleId: number
  title: string
  period: string
  dueDate: string | null
}

/**
 * 管理権限のある本人が、評価サイクルの題目・期間・締切を更新する。
 */
export class UpdateReviewCycle {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(input: Input): Promise<ReviewCycle | ApplicationError> {
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

    if (reviewCycle.status === "closed") {
      return new ConflictError("review cycle is not modifiable", "not_modifiable")
    }

    const updated = await this.c.reviewCycleRepository.updateDetails(
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
