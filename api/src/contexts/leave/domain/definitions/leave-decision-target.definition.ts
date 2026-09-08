import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { z } from "zod"

export const leaveDecisionTargetSchema = z
  .object({
    request_id: z.number().int().positive(),
    request_digest: proposalDigestSchema.transform((value): string => value),
  })
  .strict()

export type LeaveDecisionTarget = z.infer<typeof leaveDecisionTargetSchema>
