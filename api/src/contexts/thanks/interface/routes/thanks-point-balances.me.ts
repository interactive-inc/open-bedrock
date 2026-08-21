import { ThanksPointBalanceRepository } from "@/contexts/thanks/infrastructure/thanks-points/thanks-point-balance.repository"
import { UnexpectedError } from "@/lib/errors"
import { zAppThanksBalance } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"

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

  const balance = await new ThanksPointBalanceRepository(c).getBalance(session.employeeId)

  if (balance instanceof Error) {
    throw toHttpException(new UnexpectedError("failed to find balance", { cause: balance }))
  }

  const responseBody = zAppThanksBalance.parse({ balance_points: balance })

  return c.json(responseBody, 200)
})
