import type { ReviewForm } from "@/domain/review/review-form.entity"

export type ReviewerTypeSummary = {
  reviewerType: "self" | "manager" | "peer" | "subordinate"
  formCount: number
  submittedCount: number
}

const REVIEWER_TYPES = ["self", "manager", "peer", "subordinate"] as const

/**
 * 評価者種別ごとにフォーム件数と提出件数を集計する純粋関数（360度評価の提出状況）。
 * 1 件も無い種別は結果に含めない。
 */
export function toReviewerTypeSummary(
  forms: ReadonlyArray<ReviewForm>,
): ReadonlyArray<ReviewerTypeSummary> {
  const summaries: Array<ReviewerTypeSummary> = []

  for (const reviewerType of REVIEWER_TYPES) {
    const matched = forms.filter((form) => form.reviewerType === reviewerType)

    if (matched.length === 0) {
      continue
    }

    const submittedCount = matched.filter((form) => form.status === "submitted").length

    summaries.push({ reviewerType, formCount: matched.length, submittedCount })
  }

  return summaries
}
