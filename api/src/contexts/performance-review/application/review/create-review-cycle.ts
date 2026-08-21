import type { Session } from "@/contexts/company/domain/iam/session"
import { ReviewCycle } from "@/contexts/performance-review/domain/review/review-cycle.entity"
import type { Context } from "@/env"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/review/review-cycle.repository"
import {
  defaultReviewCyclePolicy,
  type ReviewCyclePolicy,
} from "@/contexts/performance-review/domain/review/review-cycle-policy"
import { ReviewCyclePolicyRepository } from "@/contexts/performance-review/infrastructure/review/review-cycle-policy.repository"

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
  constructor(private readonly c: Context) {}

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

    const savedPolicy = await new ReviewCyclePolicyRepository(this.c).upsert(
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
