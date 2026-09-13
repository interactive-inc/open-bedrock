import { z } from "zod"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"

export const expenseRetirementPlanCommandSchema = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  purpose: z.string().trim().min(1).max(255),
})

export const expenseRetirementVerificationCommandSchema = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
})

export const expenseRetirementSubmissionCommandSchema = z.strictObject({
  revision: z.discriminatedUnion("mode", [
    z.strictObject({ mode: z.literal("create"), id: z.uuid() }),
    z.strictObject({
      mode: z.literal("resubmit"),
      number: z.number().int().positive().safe(),
      previousVersion: z.number().int().positive().safe(),
      previousDigest: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ]),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  procedureKey: procedureKeySchema,
  reason: z.string().trim().min(1).max(3000),
})
