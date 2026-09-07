import { z } from "zod"

export const ringiProcedureBindingSchema = z.object({
  previousRingiId: z.number().int().positive().safe().nullable().default(null),
  requestKey: z.string().min(1).max(255),
  ringiId: z.number().int().positive().safe(),
  applicationId: z.number().int().positive().safe(),
  seriesId: z.string().min(1),
  caseId: z.string().min(1),
  proposalDigest: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.number().int().nonnegative().safe(),
})

export type RingiProcedureBinding = z.infer<typeof ringiProcedureBindingSchema>
