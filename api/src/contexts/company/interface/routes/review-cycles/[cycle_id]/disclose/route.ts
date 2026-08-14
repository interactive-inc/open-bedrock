import { DiscloseReviewCycle } from "@/application/review/disclose-review-cycle"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppReviewDiscloseResult } from "@/lib/app-schemas"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/utils/validate-int-param"

// @authorization service - session を application service に渡して判定する
/** POST /review-cycles/:cycle_id/disclose — 管理者がサイクル内の全フォームを一括開示 */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const cycleId = validateIntParam(c.req.param("cycle_id"), "review cycle")

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
