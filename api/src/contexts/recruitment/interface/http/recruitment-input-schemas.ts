import { recruitmentRecordKindSchema } from "@/contexts/recruitment/domain/definitions/recruitment-record-kind.definition"
import { z } from "zod"

export const recruitmentRecordRouteSchema = z.strictObject({
  recordKind: recruitmentRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
