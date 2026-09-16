import { onboardingRecordKindSchema } from "@/contexts/onboarding/domain/definitions/onboarding-record-kind.definition"
import { z } from "zod"

export const onboardingRecordRouteSchema = z.strictObject({
  recordKind: onboardingRecordKindSchema,
  recordId: z.string().min(1).max(1000),
  number: z.coerce.number().int().positive().safe().optional(),
})
