import { canAdministerCycle } from "@/lib/review/can-administer-cycle"
import type { Context, SessionPayload } from "@/env"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ReviewCycleRepository } from "@/infrastructure/review/review-cycle-repository"
import { ReviewFormRepository } from "@/infrastructure/review/review-form-repository"

export type Input = {
  session: SessionPayload
  cycleId: number
}

export type DiscloseResult = {
  cycleId: number
  disclosedCount: number
}

/**
 * 管理権限のある本人が、サイクル内の全評価フォームを一括で本人開示（disclosed）にする。
 */
export class DiscloseReviewCycle {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<DiscloseResult | ApplicationError> {
    if (canAdministerCycle(input.session) === false) {
      return new ForbiddenError("cannot manage review cycles", "forbidden")
    }

    const cycle = await new ReviewCycleRepository(this.c).findById(input.cycleId)

    if (cycle instanceof Error) {
      return new UnexpectedError("failed to find review cycle", { cause: cycle })
    }

    if (cycle === null) {
      return new NotFoundError("review cycle not found", "cycle_not_found")
    }

    const disclosedCount = await new ReviewFormRepository(this.c).discloseByCycleId(input.cycleId)

    if (disclosedCount instanceof Error) {
      return new UnexpectedError("failed to disclose review forms", { cause: disclosedCount })
    }

    return { cycleId: input.cycleId, disclosedCount }
  }
}
