import type { ReviewCycle } from "@/domain/review/review-cycle"
import { canAdministerCycle } from "@/domain/review/can-administer-cycle"
import type { Context } from "@/env"
import { ReviewCycleRepository } from "@/infrastructure/review/review-cycle-repository"

export type Input = {
  viewerRole: string
  cycleId: number
  status: string
}

export type Forbidden = { reason: "forbidden" }

export type CycleNotFound = { reason: "cycle_not_found" }

export type InvalidTransition = { reason: "invalid_transition" }

/**
 * 管理権限のある本人が、評価サイクルの状態（open / closed）を更新する。
 * 許可する遷移: draft→open, open→closed のみ。
 */
export class SetReviewCycleStatus {
  constructor(private readonly c: Context) {}

  async run(
    input: Input,
  ): Promise<ReviewCycle | Forbidden | CycleNotFound | InvalidTransition | Error> {
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

    const transitioned =
      input.status === "open"
        ? reviewCycle.open()
        : input.status === "closed"
          ? reviewCycle.close()
          : null

    if (transitioned === null) {
      return { reason: "invalid_transition" }
    }

    const updated = await repository.update(transitioned)

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return { reason: "cycle_not_found" }
    }

    return updated
  }
}
