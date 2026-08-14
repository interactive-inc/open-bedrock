import { ReviewForm } from "@/contexts/company/domain/review/review-form.entity"
import type { Context } from "@/env"
import { reviewCycles, reviewForms } from "@/schema"
import { and, asc, eq, inArray, ne } from "drizzle-orm"

export type CycleNotOpenError = { reason: "cycle_not_open" }

/** 一括作成する評価フォームの下書き（未採番）。 */
export type ReviewFormDraft = {
  cycleId: number
  subjectEmployeeId: number
  reviewerEmployeeId: number
  reviewerType: "self" | "manager" | "peer" | "subordinate"
}

export class ReviewFormRepository {
  constructor(private readonly c: Context) {}

  /** サイクル内の被評価者のフォームを id 昇順で返す。集計・本人開示の判定に使う。 */
  async findByCycleAndSubject(props: {
    cycleId: number
    subjectEmployeeId: number
  }): Promise<ReadonlyArray<ReviewForm> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(reviewForms)
        .where(
          and(
            eq(reviewForms.cycleId, props.cycleId),
            eq(reviewForms.subjectEmployeeId, props.subjectEmployeeId),
          ),
        )
        .orderBy(asc(reviewForms.id))

      return rows.map((row) => ReviewForm.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load review_forms")
    }
  }

  /** 被評価者のフォームを id 昇順で返す。cycleId 指定時はそのサイクルに絞る。 */
  async findBySubject(props: {
    subjectEmployeeId: number
    cycleId: number | null
    limit: number
    offset: number
  }): Promise<ReadonlyArray<ReviewForm> | Error> {
    try {
      const condition =
        props.cycleId === null
          ? eq(reviewForms.subjectEmployeeId, props.subjectEmployeeId)
          : and(
              eq(reviewForms.subjectEmployeeId, props.subjectEmployeeId),
              eq(reviewForms.cycleId, props.cycleId),
            )

      const rows = await this.c.var.database
        .select()
        .from(reviewForms)
        .where(condition)
        .orderBy(asc(reviewForms.id))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => ReviewForm.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load review_forms")
    }
  }

  /** 一括作成。新規作成のフォームは pending・hidden で始める（確定まで本人非公開）。 */
  async createMany(
    drafts: ReadonlyArray<ReviewFormDraft>,
  ): Promise<ReadonlyArray<ReviewForm> | Error> {
    try {
      if (drafts.length === 0) {
        return []
      }

      const rows = await this.c.var.database
        .insert(reviewForms)
        .values(
          drafts.map((draft) => ({
            cycleId: draft.cycleId,
            subjectEmployeeId: draft.subjectEmployeeId,
            reviewerEmployeeId: draft.reviewerEmployeeId,
            reviewerType: draft.reviewerType,
            answers: "[]",
            score: null,
            comment: null,
            status: "pending",
            submittedAt: null,
            visibility: "hidden",
          })),
        )
        .returning()

      return rows.map((row) => ReviewForm.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create review_forms")
    }
  }

  /** サイクル内の全フォームを一括開示する。更新件数を返す。 */
  async discloseByCycleId(cycleId: number): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .update(reviewForms)
        .set({ visibility: "disclosed" })
        .where(eq(reviewForms.cycleId, cycleId))
        .returning({ id: reviewForms.id })

      return rows.length
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to disclose review_forms")
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

      return { reason: "cycle_not_open" }
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update review_form")
    }
  }
}
