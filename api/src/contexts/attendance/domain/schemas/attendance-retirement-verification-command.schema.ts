import { z } from "zod"

export const attendanceRetirementVerificationCommandSchema = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
})
