import { z } from "zod"

export const executionAuthorizationIdSchema = z
  .string()
  .min(1)
  .max(255)
  .brand<"ExecutionAuthorizationId">()
export type ExecutionAuthorizationId = z.infer<typeof executionAuthorizationIdSchema>
