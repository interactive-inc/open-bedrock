import { ViewMyBalance } from "@/application/thanks-points/view-my-balance"
import { ApplicationError } from "@/lib/errors"
import { zAppThanksBalance } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { factory } from "@/interface/utils/factory"

// @authorization owner - 本人のリソースに限定する
/**
 * GET /thanks-point-balances/me — 自分の受領残高（受領 − 確定・未決裁の交換）を取得する。
 * 送れる枠である当月原資は別リソースの /thanks-point-budgets/me が返す。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const balance = await new ViewMyBalance(c).run({ employeeId: session.employeeId })

  if (balance instanceof ApplicationError) {
    throw toHttpException(balance)
  }

  const responseBody = zAppThanksBalance.parse({ balance_points: balance })

  return c.json(responseBody, 200)
})
