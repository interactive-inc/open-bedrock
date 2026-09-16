import { ringiRecordKindSchema } from "@/contexts/ringi/domain/definitions/ringi-record-kind.definition"
import { z } from "zod"

export const ringiRecordRouteSchema = z.strictObject({
  recordKind: ringiRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
