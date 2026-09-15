import { certificationRecordKindSchema } from "@/contexts/certification/domain/definitions/certification-record-kind.definition"
import { z } from "zod"

export const certificationRecordRouteSchema = z.strictObject({
  recordKind: certificationRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
