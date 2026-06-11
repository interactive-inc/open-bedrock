import { canAdministerCycle } from "@/domain/review/can-administer-cycle"
import type { ReviewCycle } from "@/domain/review/review-cycle"
import type { Context } from "@/env"
import { ReviewCycleRepository } from "@/infrastructure/review/review-cycle-repository"

export type Input = {
  viewerRole: string
  cycleId: number
  title: string
  period: string
  dueDate: string | null
}

export type Forbidden = { reason: "forbidden" }

export type CycleNotFound = { reason: "cycle_not_found" }

export type NotModifiable = { reason: "not_modifiable" }

/**
 * 管理権限のある本人が、評価サイクルの題目・期間・締切を更新する。
 */
export class UpdateReviewCycle {
  constructor(private readonly c: Context) {}

  async run(
    input: Input,
  ): Promise<ReviewCycle | Forbidden | CycleNotFound | NotModifiable | Error> {
    if (canAdministerCycle(input.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const repository = new ReviewCycleRepository(this.c)

    const reviewCycle = await repository.findById(input.cycleId)

    if (reviewCycle instanceof Error) {
      return reviewCycle
    }

    if (reviewCycle === null) {
      return { reason: "cycle_not_found" }
    }

    if (reviewCycle.status !== "draft") {
      return { reason: "not_modifiable" }
    }

    const updated = await repository.updateDetails(
      reviewCycle.withDetails({
        title: input.title,
        period: input.period,
        dueDate: input.dueDate,
      }),
    )

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return { reason: "cycle_not_found" }
    }

    return updated
  }
}
