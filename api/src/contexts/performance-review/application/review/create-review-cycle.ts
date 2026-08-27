import type { Session } from "@/lib/auth/session"
import { ReviewCycle } from "@/contexts/performance-review/domain/entities/review-cycle.entity"
import type { Context } from "@/env"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review/review-cycle.repository"
import {
  defaultReviewCyclePolicy,
  type ReviewCyclePolicy,
} from "@/contexts/performance-review/domain/definitions/review-cycle-policy.definition"
import { ReviewCyclePolicyAdapter } from "@/contexts/performance-review/infrastructure/adapters/review/review-cycle-policy.adapter"

export type Input = {
  session: Session
  title: string
  period: string
  dueDate: string | null
  policy?: ReviewCyclePolicy
}

/**
 * 管理権限のある本人が、新しい評価サイクルを draft 状態で作成する。
 */
export class CreateReviewCycle {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(input: Input): Promise<ReviewCycle | ApplicationError> {
    if (input.session.hasPermission("review:administer") === false) {
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

    if (created.id === null) {
      return new UnexpectedError("review cycle id is not assigned")
    }

    const savedPolicy = await new ReviewCyclePolicyAdapter(this.c).upsert(
      created.id,
      input.policy ?? defaultReviewCyclePolicy,
    )

    if (savedPolicy instanceof Error) {
      await new ReviewCycleRepository(this.c).delete(created.id)
      return new UnexpectedError("failed to save review cycle policy", { cause: savedPolicy })
    }

    return created
  }
}
