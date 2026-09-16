import { roomRecordKindSchema } from "@/contexts/room/domain/definitions/room-record-kind.definition"
import { z } from "zod"

export const roomRecordRouteSchema = z.strictObject({
  recordKind: roomRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
