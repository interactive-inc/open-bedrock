import { ReviewForm } from "@/domain/review/review-form"
import type { Context } from "@/env"
import { reviewCycles, reviewForms } from "@/schema"
import { and, eq, inArray, ne } from "drizzle-orm"

export type CycleNotOpenError = { reason: "cycle_not_open" }

export class ReviewFormRepository {
  constructor(private readonly c: Context) {}

  async findById(formId: number): Promise<ReviewForm | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(reviewForms)
        .where(eq(reviewForms.id, formId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : ReviewForm.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load review_form")
    }
  }

  async deleteByCycleId(cycleId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(reviewForms).where(eq(reviewForms.cycleId, cycleId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete review_forms")
    }
  }

  async update(reviewForm: ReviewForm): Promise<ReviewForm | null | CycleNotOpenError | Error> {
    try {
      const openCycleIds = this.c.var.database
        .select({ id: reviewCycles.id })
        .from(reviewCycles)
        .where(eq(reviewCycles.status, "open"))

      const rows = await this.c.var.database
        .update(reviewForms)
        .set({
          answers: JSON.stringify(reviewForm.answers),
          score: reviewForm.score,
          comment: reviewForm.comment,
          status: reviewForm.status,
          submittedAt: reviewForm.submittedAt,
        })
        .where(
          and(
            eq(reviewForms.id, reviewForm.id),
            ne(reviewForms.status, "submitted"),
            inArray(reviewForms.cycleId, openCycleIds),
          ),
        )
        .returning()

      const row = rows.at(0)

      if (row !== undefined) {
        return ReviewForm.fromRow(row)
      }

      // 0 行更新: status が submitted なのか cycle が open でないのかを区別する
      const current = await this.c.var.database
        .select({ status: reviewForms.status, cycleId: reviewForms.cycleId })
        .from(reviewForms)
        .where(eq(reviewForms.id, reviewForm.id))
        .limit(1)

      const existing = current.at(0)

      if (existing === undefined) {
        return null
      }

      if (existing.status === "submitted") {
        return null
      }

      return { reason: "cycle_not_open" as const }
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update review_form")
    }
  }
}
