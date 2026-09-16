import { z } from "zod"
import { regulationRecordKindSchema } from "@/contexts/regulation/domain/definitions/regulation-record-kind.definition"

export const regulationCoveragePageCommandSchema = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  purpose: z.string().trim().min(1).max(255),
  recordKind: regulationRecordKindSchema,
  records: z
    .array(
      z.strictObject({
        sourceRecordId: z.string().min(1).max(1000),
        preservedRecordId: z.uuid(),
      }),
    )
    .max(10),
})
