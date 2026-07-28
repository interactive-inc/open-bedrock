import { DecideRedemption } from "@/application/thanks-points/decide-redemption"
import { toPositiveInt } from "@/interface/utils/to-positive-int"
import { ApplicationError, UnexpectedError } from "@/lib/errors"
import { zAppThanksRedemptionDecision } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { BadRequestError, ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { factory } from "@/interface/utils/factory"

/** POST /thanks/redemptions/:id/reject — 交換申請を却下する（承認権限が必要） */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("thanks_redemption:approve") === false) {
    throw new ForbiddenError()
  }

  const redemptionId = toPositiveInt(c.req.param("id") ?? "")

  if (redemptionId === null) {
    throw new BadRequestError("invalid redemption id")
  }

  const result = await new DecideRedemption(c).run({
    session,
    redemptionId,
    deciderId: session.employeeId,
    action: "reject",
    decidedAt: c.env.NOW ?? new Date().toISOString(),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  if ("reason" in result) {
    throw toHttpException(new UnexpectedError("redemption cannot be rejected"))
  }

  const responseBody = zAppThanksRedemptionDecision.parse({
    id: result.id,
    status: result.status,
  })

  return c.json(responseBody, 200)
})
