import { skillRecordKindSchema } from "@/contexts/skill/domain/skill-record-kind"
import { z } from "zod"

export const skillRecordRouteSchema = z.strictObject({
  recordKind: skillRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
