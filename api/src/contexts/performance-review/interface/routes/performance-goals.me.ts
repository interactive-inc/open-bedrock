import { UnexpectedError } from "@/lib/errors"
import { GoalRepository } from "@/contexts/performance-review/infrastructure/repositories/goal/goal.repository"

import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppGoalList } from "@/contexts/performance-review/interface/http/response-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { goals } from "@/contexts/performance-review/infrastructure/schema/goal"
import { count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /performance-goals/me — 社員本人の目標一覧 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const goalRows = await (async () => {
    const command = {
      employeeId: viewer.employeeId,
      limit,
      offset,
    }

    const repository = new GoalRepository(c)

    const opts =
      command.limit !== undefined && command.offset !== undefined
        ? { limit: command.limit, offset: command.offset }
        : undefined

    const goals = await repository.findByEmployeeId(command.employeeId, opts)

    if (goals instanceof Error) {
      return new UnexpectedError("failed to load goals", { cause: goals })
    }

    return goals
  })()

  if (goalRows instanceof ApplicationError) {
    throw toHttpException(goalRows)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(goals)
    .where(eq(goals.employeeId, viewer.employeeId))

  const responseBody = zAppGoalList.parse({
    data: goalRows.map((goal) => ({
      id: goal.id,
      employee_id: goal.employeeId,
      period: goal.period,
      title: goal.title,
      kpi: goal.kpi,
      weight: goal.weight,
      status: goal.status,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
