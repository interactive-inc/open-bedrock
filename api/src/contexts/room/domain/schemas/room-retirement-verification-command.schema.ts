import { z } from "zod"

export const roomRetirementVerificationCommandSchema = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
})
