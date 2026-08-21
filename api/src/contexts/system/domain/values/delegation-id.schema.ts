import { z } from "zod"

export const delegationIdSchema = z.string().min(1).max(255).brand<"DelegationId">()
export type DelegationId = z.infer<typeof delegationIdSchema>
