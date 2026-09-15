import { compensationChangeRecordKindSchema } from "@/contexts/compensation-change/domain/compensation-change-record-kind"
import { z } from "zod"

export const compensationChangeRecordRouteSchema = z.strictObject({
  recordKind: compensationChangeRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
