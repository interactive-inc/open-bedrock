import type { ReviewCycle } from "@/domain/review/review-cycle"
import type { ReviewForm } from "@/domain/review/review-form"

export type ReviewResultView = {
  cycleId: number
  subjectEmployeeId: number
  formCount: number
  submittedCount: number
  averageScore: number | null
  forms: ReadonlyArray<ReviewForm>
}

// 提出済みフォームのスコアを集計し、被評価者ごとの結果ビューを組み立てる純粋関数。
export function toReviewResultView(
  cycle: ReviewCycle,
  forms: ReadonlyArray<ReviewForm>,
): ReviewResultView {
  let submittedCount = 0

  let scoreTotal = 0

  let subjectEmployeeId = 0

  for (const form of forms) {
    subjectEmployeeId = form.subjectEmployeeId

    if (form.status === "submitted" && form.score !== null) {
      submittedCount = submittedCount + 1

      scoreTotal = scoreTotal + form.score
    }
  }

  const averageScore = submittedCount === 0 ? null : scoreTotal / submittedCount

  return {
    cycleId: cycle.id,
    subjectEmployeeId,
    formCount: forms.length,
    submittedCount,
    averageScore,
    forms,
  }
}
