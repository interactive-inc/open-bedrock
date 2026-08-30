import { DiscloseReviewCycle } from "@/contexts/performance-review/application/review/disclose-review-cycle"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppReviewDiscloseResult } from "@/contexts/performance-review/interface/http/response-schemas"
import { verifyBearer } from "@/api/http/verify-bearer"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { validateIntParam } from "@/lib/http/validate-int-param"

// @authorization service - session を application service に渡して判定する
/** POST /review-cycles/:cycleId/disclose — 管理者がサイクル内の全フォームを一括開示 */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const cycleId = validateIntParam(c.req.param("cycleId"), "review cycle")

  const result = await new DiscloseReviewCycle(c).run({ session, cycleId })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  const responseBody = zAppReviewDiscloseResult.parse({
    cycle_id: result.cycleId,
    disclosed_count: result.disclosedCount,
  })

  return c.json(responseBody, 200)
})
