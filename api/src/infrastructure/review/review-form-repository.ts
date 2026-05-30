import { ReviewForm } from "@/domain/review/review-form"
import type { Context } from "@/env"
import { reviewForms } from "@/schema"
import { and, asc, eq } from "drizzle-orm"

export class ReviewFormRepository {
  constructor(private readonly c: Context) {}

  async findByReviewerEmployeeId(
    reviewerEmployeeId: number,
  ): Promise<ReadonlyArray<ReviewForm> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(reviewForms)
        .where(eq(reviewForms.reviewerEmployeeId, reviewerEmployeeId))
        .orderBy(asc(reviewForms.id))

      return rows.map((row) => ReviewForm.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load review_forms")
    }
  }

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

  async findByCycleIdAndSubjectEmployeeId(
    cycleId: number,
    subjectEmployeeId: number,
  ): Promise<ReadonlyArray<ReviewForm> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(reviewForms)
        .where(
          and(
            eq(reviewForms.cycleId, cycleId),
            eq(reviewForms.subjectEmployeeId, subjectEmployeeId),
          ),
        )
        .orderBy(asc(reviewForms.id))

      return rows.map((row) => ReviewForm.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load review_forms")
    }
  }

  async update(reviewForm: ReviewForm): Promise<ReviewForm | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(reviewForms)
        .set({
          answers: JSON.stringify(reviewForm.answers),
          score: reviewForm.score,
          status: reviewForm.status,
          submittedAt: reviewForm.submittedAt,
        })
        .where(eq(reviewForms.id, reviewForm.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : ReviewForm.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update review_form")
    }
  }
}
