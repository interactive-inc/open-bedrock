import { SetReviewCycleStatus } from "@/contexts/performance-review/application/review/set-review-cycle-status"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppReviewCycle } from "@/lib/app-schemas"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"

// @authorization service - session を application service に渡して判定する
/** POST /review-cycles/:cycle_id/open — 管理者が評価サイクルを open にする */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const cycleId = validateIntParam(c.req.param("cycle_id"), "review cycle")

  const updated = await new SetReviewCycleStatus(c).run({
    session: session,
    cycleId,
    status: "open",
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
