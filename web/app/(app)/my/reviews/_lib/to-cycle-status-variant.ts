import type { ReviewCycleStatus } from "@/lib/api/types/review-types"

const variants: Record<ReviewCycleStatus, "default" | "secondary" | "outline"> = {
  draft: "outline",
  open: "default",
  closed: "secondary",
}

/** 評価サイクルのステータスを Badge の variant に対応づける。 */
export function toCycleStatusVariant(
  status: ReviewCycleStatus,
): "default" | "secondary" | "outline" {
  return variants[status]
}
