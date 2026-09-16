import { leaveRecordKindSchema } from "@/contexts/leave/domain/definitions/leave-record-kind.definition"
import { z } from "zod"

export const leaveRecordRouteSchema = z.strictObject({
  recordKind: leaveRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
