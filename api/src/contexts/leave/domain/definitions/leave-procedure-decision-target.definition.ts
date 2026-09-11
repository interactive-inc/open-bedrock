import { z } from "zod"

export const leaveProcedureDecisionTargetSchema = z
  .object({
    proposal_version: z.number().int().positive(),
    proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
    task_key: z.string().min(1).max(100),
    task_round: z.number().int().positive(),
  })
  .strict()
