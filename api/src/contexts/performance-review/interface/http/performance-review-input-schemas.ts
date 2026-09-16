import { performanceReviewRecordKindSchema } from "@/contexts/performance-review/domain/definitions/performance-review-record-kind.definition"
import { z } from "zod"

export const performanceReviewRecordRouteSchema = z.strictObject({
  recordKind: performanceReviewRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
