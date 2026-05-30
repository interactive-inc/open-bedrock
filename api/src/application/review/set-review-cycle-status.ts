import type { ReviewCycle } from "@/domain/review/review-cycle"
import { canAdministerCycle } from "@/domain/review/can-administer-cycle"
import { toCycleStatus } from "@/domain/review/to-cycle-status"
import type { Context } from "@/env"
import { ReviewCycleRepository } from "@/infrastructure/review/review-cycle-repository"

export type Input = {
  viewerRole: string
  cycleId: number
  status: string
}

export type Forbidden = { reason: "forbidden" }

export type CycleNotFound = { reason: "cycle_not_found" }

/**
 * 管理権限のある本人が、評価サイクルの状態（open / closed）を更新する。
 */
export class SetReviewCycleStatus {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ReviewCycle | Forbidden | CycleNotFound | Error> {
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

    const updated = await repository.update(reviewCycle.withStatus(toCycleStatus(input.status)))

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return { reason: "cycle_not_found" }
    }

    return updated
  }
}
