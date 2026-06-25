import { SetReviewCycleStatus } from "@/application/review/set-review-cycle-status"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppReviewCycle } from "@/lib/app-schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/shared/validate-int-param"

// POST /review-cycles/:cycle_id/close — 管理者が評価サイクルを closed にする
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const cycleId = validateIntParam(c.req.param("cycle_id"), "review cycle")

  const updated = await new SetReviewCycleStatus(c).run({
    viewerRole: session.role,
    cycleId,
    status: "closed",
  })

  if (updated instanceof ApplicationError) {
    throw toHttpException(updated)
  }

  const responseBody = zAppReviewCycle.parse({
    id: updated.id,
    title: updated.title,
    period: updated.period,
    status: updated.status,
    due_date: updated.dueDate,
  })

  return c.json(responseBody, 200)
})
