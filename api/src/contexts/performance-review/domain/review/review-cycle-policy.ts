import { z } from "zod"

export const zReviewCyclePolicy = z.object({
  include_self: z.boolean().default(true),
  include_manager: z.boolean().default(true),
  include_peers: z.boolean().default(false),
  include_subordinates: z.boolean().default(false),
  peer_count: z.number().int().min(0).max(20).default(0),
})

export type ReviewCyclePolicy = z.infer<typeof zReviewCyclePolicy>

export const defaultReviewCyclePolicy: ReviewCyclePolicy = zReviewCyclePolicy.parse({})
