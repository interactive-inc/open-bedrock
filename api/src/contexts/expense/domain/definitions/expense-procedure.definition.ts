import { attachmentEvidenceSchema } from "@system/domain/definitions/attachments/attachment-evidence.definition"
import { z } from "zod"

export const expenseProcedureBindingSchema = z.object({
  previousExpenseId: z.number().int().positive().safe().nullable(),
  requestKey: z.string().min(1).max(255),
  expenseId: z.number().int().positive().safe(),
  applicationId: z.number().int().positive().safe(),
  seriesId: z.string().min(1),
  caseId: z.string().min(1),
  proposalDigest: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.number().int().nonnegative().safe(),
  attachments: z.array(attachmentEvidenceSchema).max(10),
})

export type ExpenseProcedureBinding = z.infer<typeof expenseProcedureBindingSchema>
