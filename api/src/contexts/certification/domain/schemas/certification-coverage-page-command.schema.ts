import { z } from "zod"
import { certificationRecordKindSchema } from "@/contexts/certification/domain/definitions/certification-record-kind.definition"

export const certificationCoveragePageCommandSchema = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  purpose: z.string().trim().min(1).max(255),
  recordKind: certificationRecordKindSchema,
  records: z
    .array(
      z.strictObject({
        sourceRecordId: z.string().min(1).max(1000),
        preservedRecordId: z.uuid(),
      }),
    )
    .max(10),
})
