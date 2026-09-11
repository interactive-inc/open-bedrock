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

/** 利用者に表示する、提出前と判断後の確定待ちを含む休暇の状態。 */
export const leaveProcedureStatusSchema = z.enum([
  "draft",
  "pending",
  "approved",
  "rejected",
  "returned",
  "cancelled",
  "awaiting_execution",
])
export type LeaveProcedureStatus = z.infer<typeof leaveProcedureStatusSchema>
