import { ViewMyBudget } from "@/application/thanks-points/view-my-budget"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"

// GET /thanks/budget/me — 自分の当月の贈与原資（付与・消費・残量）を取得する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const budget = await new ViewMyBudget(c).run({
    employeeId: session.employeeId,
    now: c.env.NOW ?? new Date().toISOString(),
  })

  if (budget instanceof Error) {
    throw new InternalError("failed to load budget")
  }

  return c.json(
    {
      period: budget.period,
      granted_points: budget.grantedPoints,
      consumed_points: budget.consumedPoints,
      remaining_points: budget.remainingPoints,
    },
    200,
  )
})
