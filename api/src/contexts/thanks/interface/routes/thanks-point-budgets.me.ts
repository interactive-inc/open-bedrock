import { ViewMyBudget } from "@/contexts/thanks/application/thanks-points/view-my-budget"
import { ApplicationError } from "@/lib/errors"
import { zAppThanksBudget } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"

// @authorization owner - 本人のリソースに限定する
/** GET /thanks-point-budgets/me — 自分の当月の贈与原資（付与・消費・残量）を取得する */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const budget = await new ViewMyBudget(c).run({
    employeeId: session.employeeId,
    now: c.env.NOW ?? new Date().toISOString(),
  })

  if (budget instanceof ApplicationError) {
    throw toHttpException(budget)
  }

  const responseBody = zAppThanksBudget.parse({
    period: budget.period,
    granted_points: budget.grantedPoints,
    consumed_points: budget.consumedPoints,
    remaining_points: budget.remainingPoints,
  })

  return c.json(responseBody, 200)
})
