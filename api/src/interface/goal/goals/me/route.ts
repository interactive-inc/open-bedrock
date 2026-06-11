import { ListMyGoals } from "@/application/goal/list-my-goals"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { goals } from "@/schema"
import { count, eq } from "drizzle-orm"

// GET /goals/me — 社員本人の目標一覧
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

  const goalRows = await new ListMyGoals(c).run({
    employeeId: viewer.employeeId,
    limit,
    offset,
  })

  if (goalRows instanceof Error) {
    throw new InternalError("failed to load goals")
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(goals)
    .where(eq(goals.employeeId, viewer.employeeId))

  const responseBody = goalRows.map((goal) => ({
    id: goal.id,
    employee_id: goal.employeeId,
    period: goal.period,
    title: goal.title,
    kpi: goal.kpi,
    weight: goal.weight,
    status: goal.status,
  }))

  return c.json({ data: responseBody, total: totalRows.at(0)?.total ?? 0 }, 200)
})
