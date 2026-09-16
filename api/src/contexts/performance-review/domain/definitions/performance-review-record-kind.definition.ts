import { z } from "zod"

export const performanceReviewRecordKinds = [
  "evaluation-sheet-audit-log-record",
  "evaluation-sheet-record",
  "evaluation-template-record",
  "goal-evaluation-record",
  "performance-goal-record",
  "review-cycle-policy-record",
  "review-cycle-record",
  "review-form-record",
] as const

export const performanceReviewRecordKindSchema = z.enum(performanceReviewRecordKinds)
export type PerformanceReviewRecordKind = z.infer<typeof performanceReviewRecordKindSchema>
