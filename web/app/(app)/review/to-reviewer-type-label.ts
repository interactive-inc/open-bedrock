import type { ReviewerType } from "@/lib/api/types/review-types"

const labels: Record<ReviewerType, string> = {
  self: "自己評価",
  manager: "上司評価",
  peer: "同僚評価",
  subordinate: "部下評価",
}

// 評価者の種別を日本語ラベルに変換する。
export function toReviewerTypeLabel(reviewerType: ReviewerType): string {
  return labels[reviewerType]
}
