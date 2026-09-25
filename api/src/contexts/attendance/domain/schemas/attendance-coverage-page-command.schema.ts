import { z } from "zod"

export const attendanceCoveragePageCommandSchema = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  purpose: z.string().trim().min(1).max(255),
  records: z
    .array(
      z.strictObject({
        sourceRecordId: z.uuid(),
        preservedRecordId: z.uuid(),
      }),
    )
    .max(10),
})
