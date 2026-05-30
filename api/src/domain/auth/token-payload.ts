import { z } from "zod"

export const tokenPayloadSchema = z.object({
  employeeId: z.number(),
  email: z.string(),
  role: z.string(),
})

export type TokenPayload = z.infer<typeof tokenPayloadSchema>
