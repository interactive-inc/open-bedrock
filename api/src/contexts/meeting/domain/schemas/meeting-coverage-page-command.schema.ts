import { z } from "zod"
import { meetingRecordKindSchema } from "@/contexts/meeting/domain/definitions/meeting-record-kind.definition"

export const meetingCoveragePageCommandSchema = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  purpose: z.string().trim().min(1).max(255),
  recordKind: meetingRecordKindSchema,
  records: z
    .array(
      z.strictObject({
        sourceRecordId: z.string().min(1).max(1000),
        preservedRecordId: z.uuid(),
      }),
    )
    .max(10),
})
