import { careerRecordKindSchema } from "@/contexts/career/domain/career-record-kind"
import { z } from "zod"

export const careerRecordRouteSchema = z.strictObject({
  recordKind: careerRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
