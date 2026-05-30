import type { ReviewCycle } from "@/domain/review/review-cycle"

// 任意文字列を ReviewCycle の status へ正規化する。未知の値は draft に倒す。
export function toCycleStatus(status: string): ReviewCycle["status"] {
  if (status === "open") {
    return "open"
  }

  if (status === "closed") {
    return "closed"
  }

  return "draft"
}
