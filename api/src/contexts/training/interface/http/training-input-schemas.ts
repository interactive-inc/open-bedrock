import { trainingRecordKindSchema } from "@/contexts/training/domain/training-record-kind"
import { z } from "zod"

export const trainingRecordRouteSchema = z.strictObject({
  recordKind: trainingRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
