import { canAdministerCycle } from "@/domain/review/can-administer-cycle"
import type { Context } from "@/env"
import { ReviewCycleRepository } from "@/infrastructure/review/review-cycle-repository"

export type Input = {
  viewerRole: string
  cycleId: number
}

export type Forbidden = { reason: "forbidden" }

export type CycleNotFound = { reason: "cycle_not_found" }

export type NotDeletable = { reason: "not_deletable" }

export type Deleted = { reason: "deleted" }

/**
 * 管理権限のある本人が、評価サイクルを削除する。
 * draft 状態のサイクルのみ削除を許可する。
 */
export class DeleteReviewCycle {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<Deleted | Forbidden | CycleNotFound | NotDeletable | Error> {
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

    if (!reviewCycle.isDeletable) {
      return { reason: "not_deletable" }
    }

    const db = this.c.env.DB

    try {
      await db.batch([
        db
          .prepare("DELETE FROM review_cycles WHERE id = ?1 AND status = 'draft'")
          .bind(input.cycleId),
        abortWhenPreviousStatementChangedNoRows(db),
        db.prepare("DELETE FROM review_forms WHERE cycle_id = ?1").bind(input.cycleId),
      ])
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return { reason: "not_deletable" }
      }
      return error instanceof Error ? error : new Error("failed to delete review cycle")
    }

    return { reason: "deleted" }
  }
}

function abortWhenPreviousStatementChangedNoRows(db: D1Database): D1PreparedStatement {
  return db.prepare("SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END AS ok")
}

function isAbortedByGuard(error: unknown): boolean {
  return error instanceof Error && error.message.includes("malformed JSON")
}
