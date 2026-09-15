import { skillRecordKindSchema } from "@/contexts/skill/domain/definitions/skill-record-kind.definition"
import { z } from "zod"

export const skillRecordRouteSchema = z.strictObject({
  recordKind: skillRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
