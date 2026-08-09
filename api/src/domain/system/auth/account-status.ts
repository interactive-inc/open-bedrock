import { z } from "zod"

/** 認証を許可する Account の状態。 */
export const accountStatusSchema = z.enum(["active", "suspended", "locked"])

export type AccountStatus = z.infer<typeof accountStatusSchema>
