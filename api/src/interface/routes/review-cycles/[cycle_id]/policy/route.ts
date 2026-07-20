import { zReviewCyclePolicy } from "@/domain/review/review-cycle-policy"
import { ReviewCyclePolicyRepository } from "@/infrastructure/review/review-cycle-policy-repository"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { factory } from "@/interface/utils/factory"
import { reviewCycles } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { eq } from "drizzle-orm"
import type { Context } from "@/env"

function authorize(c: Context) {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  if (session.hasPermission("review:administer") === false) throw new ForbiddenError()
}

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  authorize(c)
  const cycleId = validateIntParam(c.req.param("cycle_id"), "review cycle")
  const cycle = await c.var.database
    .select({ id: reviewCycles.id })
    .from(reviewCycles)
    .where(eq(reviewCycles.id, cycleId))
    .limit(1)
    .then((rows) => rows.at(0))
  if (cycle === undefined) throw new NotFoundError("review cycle not found")
  const policy = await new ReviewCyclePolicyRepository(c).find(cycleId)
  if (policy instanceof Error) throw new InternalError("failed to load review policy")
  return c.json({ policy }, 200)
})

export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator("json", zReviewCyclePolicy),
  async (c) => {
    authorize(c)
    const cycleId = validateIntParam(c.req.param("cycle_id"), "review cycle")
    const cycle = await c.var.database
      .select({ status: reviewCycles.status })
      .from(reviewCycles)
      .where(eq(reviewCycles.id, cycleId))
      .limit(1)
      .then((rows) => rows.at(0))
    if (cycle === undefined) throw new NotFoundError("review cycle not found")
    if (cycle.status !== "draft") throw new ConflictError("review policy is locked after opening")
    const policy = c.req.valid("json")
    const saved = await new ReviewCyclePolicyRepository(c).upsert(cycleId, policy)
    if (saved instanceof Error) throw new InternalError("failed to save review policy")
    return c.json({ policy }, 200)
  },
)
