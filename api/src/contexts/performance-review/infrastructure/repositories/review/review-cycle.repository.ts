import { ReviewCycle } from "@/contexts/performance-review/domain/entities/review-cycle.entity"
import type { Context } from "@/env"
import { reviewCycles } from "@/contexts/performance-review/infrastructure/schema/performance-review"
import { and, asc, eq, ne } from "drizzle-orm"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import { ConflictError } from "@/lib/errors"

export class ReviewCycleRepository {
  constructor(private readonly c: Context) {}

  async findMany(props: {
    limit: number
    offset: number
  }): Promise<ReadonlyArray<ReviewCycle> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(reviewCycles)
        .orderBy(asc(reviewCycles.id))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => ReviewCycle.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load review_cycles")
    }
  }

  async findById(cycleId: number): Promise<ReviewCycle | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(reviewCycles)
        .where(eq(reviewCycles.id, cycleId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : ReviewCycle.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load review_cycle")
    }
  }

  async create(reviewCycle: ReviewCycle): Promise<ReviewCycle | Error> {
    try {
      const rows = await this.c.var.database
        .insert(reviewCycles)
        .values({
          title: reviewCycle.title,
          period: reviewCycle.period,
          status: reviewCycle.status,
          dueDate: reviewCycle.dueDate,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert review_cycle")
        : ReviewCycle.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert review_cycle")
    }
  }

  /** status のみを更新する。title/period/dueDate の変更は updateDetails を使う。 */
  async updateStatus(
    reviewCycle: ReviewCycle,
    previousStatus: ReviewCycle["status"],
  ): Promise<ReviewCycle | null | Error> {
    try {
      if (reviewCycle.id === null) {
        return new Error("cannot update unsaved review cycle")
      }

      const rows = await this.c.var.database
        .update(reviewCycles)
        .set({ status: reviewCycle.status })
        .where(and(eq(reviewCycles.id, reviewCycle.id), eq(reviewCycles.status, previousStatus)))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : ReviewCycle.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update review_cycle")
    }
  }

  async updateDetails(reviewCycle: ReviewCycle): Promise<ReviewCycle | null | Error> {
    try {
      if (reviewCycle.id === null) {
        return new Error("cannot update unsaved review cycle")
      }

      const rows = await this.c.var.database
        .update(reviewCycles)
        .set({
          title: reviewCycle.title,
          period: reviewCycle.period,
          dueDate: reviewCycle.dueDate,
        })
        .where(and(ne(reviewCycles.status, "closed"), eq(reviewCycles.id, reviewCycle.id)))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : ReviewCycle.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update review_cycle")
    }
  }

  async delete(cycleId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(reviewCycles).where(eq(reviewCycles.id, cycleId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete review_cycle")
    }
  }

  async deleteWithForms(reviewCycle: ReviewCycle): Promise<null | Error> {
    if (reviewCycle.id === null) {
      return new Error("cannot delete unsaved review cycle")
    }

    try {
      const db = this.c.env.DB
      await db.batch([
        db.prepare("DELETE FROM review_forms WHERE cycle_id = ?1").bind(reviewCycle.id),
        db
          .prepare("DELETE FROM review_cycles WHERE id = ?1 AND status = 'draft'")
          .bind(reviewCycle.id),
        abortWhenPreviousStatementChangedNoRows(db),
      ])
      return null
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return new ConflictError("review cycle is not deletable", "not_deletable")
      }
      return error instanceof Error ? error : new Error("failed to delete review cycle")
    }
  }
}
