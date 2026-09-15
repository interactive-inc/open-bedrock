import { surveyRecordKindSchema } from "@/contexts/survey/domain/definitions/survey-record-kind.definition"
import { z } from "zod"

export const surveyRecordRouteSchema = z.strictObject({
  recordKind: surveyRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
