import { shiftRecordKindSchema } from "@/contexts/shift/domain/definitions/shift-record-kind.definition"
import { z } from "zod"

export const shiftRecordRouteSchema = z.strictObject({
  recordKind: shiftRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
