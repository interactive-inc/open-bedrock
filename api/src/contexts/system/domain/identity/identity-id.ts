import { z } from "zod"

/** Adapterが十分なentropyで生成する、正規化しないopaque Identity ID。 */
export const zIdentityId = z.string().min(1).max(255).brand<"IdentityId">()

export type IdentityId = z.infer<typeof zIdentityId>
