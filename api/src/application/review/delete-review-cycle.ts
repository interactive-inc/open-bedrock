import { canAdministerCycle } from "@/domain/review/can-administer-cycle"
import type { Context } from "@/env"
import { ReviewCycleRepository } from "@/infrastructure/review/review-cycle-repository"

export type Input = {
  viewerRole: string
  cycleId: number
}

export type Forbidden = { reason: "forbidden" }

export type CycleNotFound = { reason: "cycle_not_found" }

export type Deleted = { reason: "deleted" }

/**
 * 管理権限のある本人が、評価サイクルを削除する。
 */
export class DeleteReviewCycle {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<Deleted | Forbidden | CycleNotFound | Error> {
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

    const deleted = await repository.delete(input.cycleId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "deleted" }
  }
}
