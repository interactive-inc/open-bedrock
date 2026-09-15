import { assetRecordKindSchema } from "@/contexts/asset/domain/definitions/asset-record-kind.definition"
import { z } from "zod"

export const assetRecordRouteSchema = z.strictObject({
  recordKind: assetRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
