import type { ReviewCycleStatus } from "@/lib/api/types/review-types"

const labels: Record<ReviewCycleStatus, string> = {
  draft: "下書き",
  open: "実施中",
  closed: "終了",
}

/** 評価サイクルのステータスを日本語ラベルに変換する。 */
export function toCycleStatusLabel(status: ReviewCycleStatus): string {
  return labels[status]
}
