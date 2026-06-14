import { z } from "zod"

export const reviewCycleStatusSchema = z.enum(["draft", "open", "closed"])

export type ReviewCycleStatus = z.infer<typeof reviewCycleStatusSchema>

// 任意文字列を評価サイクルの status へ正規化する。未知の値は draft に倒す。
export function toReviewCycleStatus(status: string): ReviewCycleStatus {
  if (status === "open") {
    return "open"
  }

  if (status === "closed") {
    return "closed"
  }

  return "draft"
}
