import { z } from "zod"

export const systemCaseIdSchema = z.string().min(1).max(255).brand<"SystemCaseId">()
export type SystemCaseId = z.infer<typeof systemCaseIdSchema>

export const systemCaseStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "returned",
  "cancelled",
  "executed",
])
export type SystemCaseStatus = z.infer<typeof systemCaseStatusSchema>
