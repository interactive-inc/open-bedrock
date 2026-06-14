import { canAdministerCycle } from "@/lib/review/can-administer-cycle"
import { ReviewCycle } from "@/domain/review/review-cycle.entity"
import type { Context } from "@/env"
import { ReviewCycleRepository } from "@/infrastructure/review/review-cycle-repository"

export type Input = {
  viewerRole: string
  title: string
  period: string
  dueDate: string | null
}

export type Forbidden = { reason: "forbidden" }

/**
 * 管理権限のある本人が、新しい評価サイクルを draft 状態で作成する。
 */
export class CreateReviewCycle {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ReviewCycle | Forbidden | Error> {
    if (canAdministerCycle(input.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const reviewCycle = ReviewCycle.create({
      title: input.title,
      period: input.period,
      dueDate: input.dueDate,
    })

    return await new ReviewCycleRepository(this.c).create(reviewCycle)
  }
}
