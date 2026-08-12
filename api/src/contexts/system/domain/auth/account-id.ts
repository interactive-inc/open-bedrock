import { z } from "zod"

/** JWT subject と adapter の間で共有する、正規化しない opaque Account ID。 */
export const zAccountId = z.string().min(1).max(255).brand<"AccountId">()

export type AccountId = z.infer<typeof zAccountId>
