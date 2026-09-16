import { governanceRecordKindSchema } from "@/contexts/governance/domain/definitions/governance-record-kind.definition"
import { z } from "zod"

export const governanceRecordRouteSchema = z.strictObject({
  recordKind: governanceRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
