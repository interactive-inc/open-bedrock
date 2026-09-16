import { partnerRecordKindSchema } from "@/contexts/partner/domain/definitions/partner-record-kind.definition"
import { z } from "zod"

export const partnerRecordRouteSchema = z.strictObject({
  recordKind: partnerRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
