import { regulationRecordKindSchema } from "@/contexts/regulation/domain/definitions/regulation-record-kind.definition"
import { z } from "zod"

export const regulationRecordRouteSchema = z.strictObject({
  recordKind: regulationRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
