import { periodOf } from "@/contexts/thanks/domain/definitions/thanks-period.definition"
import { UnexpectedError } from "@/lib/errors"
import { ThanksPointBudgetRepository } from "@/contexts/thanks/infrastructure/thanks-points/thanks-point-budget.repository"

import { ApplicationError } from "@/lib/errors"
import { zAppThanksBudget } from "@/lib/app-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"

// @authorization owner - 本人のリソースに限定する
/** GET /thanks-point-budgets/me — 自分の当月の贈与原資（付与・消費・残量）を取得する */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const budget = await (async () => {
    const props = {
      employeeId: session.employeeId,
      now: c.env.NOW ?? new Date().toISOString(),
    }

    const budgetRepository = new ThanksPointBudgetRepository(c)

    const period = periodOf(props.now)

    const budget = await budgetRepository.findOrCreate({
      employeeId: props.employeeId,
      period,
      createdAt: props.now,
    })

    if (budget instanceof Error) {
      return new UnexpectedError("failed to find budget", { cause: budget })
    }

    return {
      period,
      grantedPoints: budget.grantedPoints,
      consumedPoints: budget.consumedPoints,
      remainingPoints: budget.remainingPoints,
    }
  })()

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
