import { OpenReviewCycle } from "@/contexts/performance-review/application/review/open-review-cycle"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppReviewCycle } from "@/contexts/performance-review/interface/http/response-schemas"
import { verifyBearer } from "@/api/http/verify-bearer"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { validateIntParam } from "@/lib/http/validate-int-param"

// @authorization service - session を application service に渡して判定する
/** POST /review-cycles/:cycleId/open — 管理者が評価サイクルを open にする */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const cycleId = validateIntParam(c.req.param("cycleId"), "review cycle")

  const updated = await new OpenReviewCycle(c).execute({
    session: session,
    cycleId,
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
