import { z } from "zod"

export const leaveProcedureBindingSchema = z.strictObject({
  requestKey: z.string().uuid(),
  leaveRequestId: z.number().int().positive().safe(),
  previousLeaveRequestId: z.number().int().positive().safe().nullable(),
  applicationId: z.number().int().positive().safe(),
  seriesId: z.string().min(1),
  caseId: z.string().min(1),
  proposalDigest: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.number().int().nonnegative().safe(),
})
export type LeaveProcedureBinding = z.infer<typeof leaveProcedureBindingSchema>
