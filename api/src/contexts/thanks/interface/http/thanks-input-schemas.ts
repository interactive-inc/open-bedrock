import { thanksRecordKindSchema } from "@/contexts/thanks/domain/thanks-record-kind"
import { z } from "zod"

export const thanksRecordRouteSchema = z.strictObject({
  recordKind: thanksRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
