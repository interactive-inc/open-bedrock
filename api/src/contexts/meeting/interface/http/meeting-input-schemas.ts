import { meetingRecordKindSchema } from "@/contexts/meeting/domain/definitions/meeting-record-kind.definition"
import { z } from "zod"

export const meetingRecordRouteSchema = z.strictObject({
  recordKind: meetingRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
