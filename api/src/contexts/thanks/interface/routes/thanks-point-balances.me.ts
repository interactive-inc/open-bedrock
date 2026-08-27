import { ThanksPointBalanceAdapter } from "@/contexts/thanks/infrastructure/adapters/thanks-points/thanks-point-balance.adapter"
import { UnexpectedError } from "@/lib/errors"
import { zAppThanksBalance } from "@/lib/app-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"

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

  const balance = await new ThanksPointBalanceAdapter(c).getBalance(session.employeeId)

  if (balance instanceof Error) {
    throw toHttpException(new UnexpectedError("failed to find balance", { cause: balance }))
  }

  const responseBody = zAppThanksBalance.parse({ balance_points: balance })

  return c.json(responseBody, 200)
})
