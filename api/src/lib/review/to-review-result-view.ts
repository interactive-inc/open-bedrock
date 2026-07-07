import type { ReviewCycle } from "@/domain/review/review-cycle.entity"
import type { ReviewForm } from "@/domain/review/review-form.entity"
import type { ReviewerTypeSummary } from "@/lib/review/to-reviewer-type-summary"
import { toReviewerTypeSummary } from "@/lib/review/to-reviewer-type-summary"

export type ReviewResultView = {
  cycleId: number
  subjectEmployeeId: number
  formCount: number
  submittedCount: number
  averageScore: number | null
  reviewerTypeSummary: ReadonlyArray<ReviewerTypeSummary>
  forms: ReadonlyArray<ReviewForm>
}

/** 提出済みフォームのスコアを集計し、被評価者ごとの結果ビューを組み立てる純粋関数。 */
export function toReviewResultView(
  cycle: ReviewCycle,
  forms: ReadonlyArray<ReviewForm>,
  subjectEmployeeId: number,
): ReviewResultView | Error {
  if (cycle.id === null) {
    return new Error("cannot build result view for unsaved review cycle")
  }

  let submittedCount = 0

  let scoredCount = 0

  let scoreTotal = 0

  for (const form of forms) {
    if (form.status === "submitted") {
      submittedCount = submittedCount + 1

      // スコア未記入の提出もあるため、平均はスコアありの件数で割る。
      if (form.score !== null) {
        scoredCount = scoredCount + 1

        scoreTotal = scoreTotal + form.score
      }
    }
  }

  const averageScore = scoredCount === 0 ? null : scoreTotal / scoredCount

  return {
    cycleId: cycle.id,
    subjectEmployeeId,
    formCount: forms.length,
    submittedCount,
    averageScore,
    reviewerTypeSummary: toReviewerTypeSummary(forms),
    forms,
  }
}
