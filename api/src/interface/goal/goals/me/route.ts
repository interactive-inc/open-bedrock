import { ListMyGoals } from "@/application/goal/list-my-goals"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

// GET /goals/me — 社員本人の目標一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const goals = await new ListMyGoals(c).run({
    employeeId: viewer.employeeId,
  })

  if (goals instanceof Error) {
    throw new InternalError("failed to load goals")
  }

  const responseBody = goals.map((goal) => ({
    id: goal.id,
    employee_id: goal.employeeId,
    period: goal.period,
    title: goal.title,
    kpi: goal.kpi,
    weight: goal.weight,
    status: goal.status,
  }))

  return c.json(responseBody, 200)
})
