import { DecideRedemption } from "@/application/thanks-points/decide-redemption"
import { toPositiveInt } from "@/interface/utils/to-positive-int"
import { ApplicationError } from "@/lib/errors"
import { zAppThanksRedemptionDecision } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { factory } from "@/interface/utils/factory"

// @authorization permission - 権限キーで判定する
/** POST /thanks-redemptions/:id/approve — 交換申請を承認・確定する（承認権限が必要） */
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
    action: "approve",
    decidedAt: c.env.NOW ?? new Date().toISOString(),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  if ("reason" in result) {
    if (result.reason === "out_of_stock") {
      throw new ConflictError("reward out of stock")
    }

    // 交換は確定済みだが在庫減算だけ失敗。確定は巻き戻さず、追跡できるよう構造化ログを残し
    // レスポンスにも stock_warning を立てて運用側が手当てできるようにする（握りつぶさない）。
    console.error(
      JSON.stringify({
        event: "thanks_redemption_stock_decrement_failed",
        redemption_id: result.redemption.id,
        reward_id: result.redemption.rewardId,
        message: result.stockError.message,
      }),
    )

    const warningBody = zAppThanksRedemptionDecision.parse({
      id: result.redemption.id,
      status: result.redemption.status,
      stock_warning: true,
    })

    return c.json(warningBody, 200)
  }

  const responseBody = zAppThanksRedemptionDecision.parse({
    id: result.id,
    status: result.status,
    stock_warning: false,
  })

  return c.json(responseBody, 200)
})
