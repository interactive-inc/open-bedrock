import type { ReviewCycle } from "@/domain/review/review-cycle.entity"
import { canAdministerCycle } from "@/lib/review/can-administer-cycle"
import type { Context, SessionPayload } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ReviewCycleRepository } from "@/infrastructure/review/review-cycle-repository"

export type Input = {
  session: SessionPayload
  cycleId: number
  status: string
}

/**
 * 管理権限のある本人が、評価サイクルの状態（open / closed）を更新する。
 * 許可する遷移: draft→open, open→closed のみ。
 */
export class SetReviewCycleStatus {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ReviewCycle | ApplicationError> {
    if (canAdministerCycle(input.session) === false) {
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

    const transitioned =
      input.status === "open"
        ? reviewCycle.open()
        : input.status === "closed"
          ? reviewCycle.close()
          : null

    if (transitioned === null) {
      return new ConflictError("invalid review cycle transition", "invalid_transition")
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
