import type { Session } from "@/contexts/company/domain/iam/session"
import type { Context } from "@/env"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/d1/is-aborted-by-guard"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ReviewCycleRepository } from "@/infrastructure/review/review-cycle-repository"

export type Input = {
  session: Session
  cycleId: number
}

export type Deleted = { reason: "deleted" }

/**
 * 管理権限のある本人が、評価サイクルを削除する。
 * draft 状態のサイクルのみ削除を許可する。
 */
export class DeleteReviewCycle {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<Deleted | ApplicationError> {
    if (input.session.hasPermission("review:administer") === false) {
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

    if (!reviewCycle.isDeletable) {
      return new ConflictError("review cycle is not deletable", "not_deletable")
    }

    const db = this.c.env.DB

    try {
      await db.batch([
        db.prepare("DELETE FROM review_forms WHERE cycle_id = ?1").bind(input.cycleId),
        db
          .prepare("DELETE FROM review_cycles WHERE id = ?1 AND status = 'draft'")
          .bind(input.cycleId),
        abortWhenPreviousStatementChangedNoRows(db),
      ])
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return new ConflictError("review cycle is not deletable", "not_deletable")
      }

      return error instanceof Error
        ? new UnexpectedError("failed to delete review cycle", { cause: error })
        : new UnexpectedError("failed to delete review cycle")
    }

    return { reason: "deleted" }
  }
}
