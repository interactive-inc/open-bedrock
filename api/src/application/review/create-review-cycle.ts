import { canAdministerCycle } from "@/lib/review/can-administer-cycle"
import { ReviewCycle } from "@/domain/review/review-cycle.entity"
import type { Context, SessionPayload } from "@/env"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ReviewCycleRepository } from "@/infrastructure/review/review-cycle-repository"

export type Input = {
  session: SessionPayload
  title: string
  period: string
  dueDate: string | null
}

/**
 * 管理権限のある本人が、新しい評価サイクルを draft 状態で作成する。
 */
export class CreateReviewCycle {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ReviewCycle | ApplicationError> {
    if (canAdministerCycle(input.session) === false) {
      return new ForbiddenError("cannot manage review cycles", "forbidden")
    }

    const reviewCycle = ReviewCycle.create({
      title: input.title,
      period: input.period,
      dueDate: input.dueDate,
    })

    const created = await new ReviewCycleRepository(this.c).create(reviewCycle)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create review cycle", { cause: created })
    }

    return created
  }
}
