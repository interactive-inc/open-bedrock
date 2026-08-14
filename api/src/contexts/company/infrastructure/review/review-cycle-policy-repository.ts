import {
  defaultReviewCyclePolicy,
  type ReviewCyclePolicy,
  zReviewCyclePolicy,
} from "@/contexts/company/domain/review/review-cycle-policy"
import type { Context } from "@/env"
import { reviewCyclePolicies } from "@/schema"
import { eq } from "drizzle-orm"

export class ReviewCyclePolicyRepository {
  constructor(private readonly c: Context) {}

  async find(cycleId: number): Promise<ReviewCyclePolicy | Error> {
    try {
      const row = await this.c.var.database
        .select({ policyJson: reviewCyclePolicies.policyJson })
        .from(reviewCyclePolicies)
        .where(eq(reviewCyclePolicies.cycleId, cycleId))
        .limit(1)
        .then((rows) => rows.at(0))

      if (row === undefined) return defaultReviewCyclePolicy

      return zReviewCyclePolicy.parse(JSON.parse(row.policyJson))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load review cycle policy")
    }
  }

  async upsert(cycleId: number, policy: ReviewCyclePolicy): Promise<null | Error> {
    try {
      await this.c.var.database
        .insert(reviewCyclePolicies)
        .values({ cycleId, policyJson: JSON.stringify(policy) })
        .onConflictDoUpdate({
          target: reviewCyclePolicies.cycleId,
          set: { policyJson: JSON.stringify(policy) },
        })
      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save review cycle policy")
    }
  }
}
