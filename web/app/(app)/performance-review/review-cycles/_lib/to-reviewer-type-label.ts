import type { ReviewerType } from "@/lib/api/types/review-types"

const labels: Record<ReviewerType, string> = {
  self: "自己評価",
  manager: "上司評価",
  peer: "同僚評価",
  subordinate: "部下評価",
}

function isReviewerType(value: string): value is ReviewerType {
  return value in labels
}

/** 評価者の種別を日本語ラベルに変換する。未知の値はそのまま返す。 */
export function toReviewerTypeLabel(reviewerType: string): string {
  if (isReviewerType(reviewerType)) {
    return labels[reviewerType]
  }

  return reviewerType
}
