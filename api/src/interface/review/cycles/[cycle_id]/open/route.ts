import { SetReviewCycleStatus } from "@/application/review/set-review-cycle-status"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"

// POST /review-cycles/:cycle_id/open — 管理者が評価サイクルを open にする
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const cycleId = Number(c.req.param("cycle_id"))

  if (Number.isInteger(cycleId) === false) {
    throw new BadRequestError("invalid cycle id")
  }

  const updated = await new SetReviewCycleStatus(c).run({
    viewerRole: session.role,
    cycleId,
    status: "open",
  })

  if (updated instanceof Error) {
    throw new InternalError("failed to update review cycle")
  }

  if ("reason" in updated) {
    if (updated.reason === "forbidden") {
      throw new ForbiddenError()
    }

    throw new NotFoundError("review cycle not found")
  }

  const responseBody = {
    id: updated.id,
    title: updated.title,
    period: updated.period,
    status: updated.status,
    due_date: updated.dueDate,
  }

  return c.json(responseBody, 200)
})
