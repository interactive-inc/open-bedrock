import { z } from "zod"

export const humanAttestationIdSchema = z.string().min(1).max(255).brand<"HumanAttestationId">()
export type HumanAttestationId = z.infer<typeof humanAttestationIdSchema>
