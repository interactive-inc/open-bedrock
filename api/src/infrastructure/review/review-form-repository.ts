import { ReviewForm } from "@/domain/review/review-form"
import type { Context } from "@/env"
import { reviewForms } from "@/schema"
import { eq } from "drizzle-orm"

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
