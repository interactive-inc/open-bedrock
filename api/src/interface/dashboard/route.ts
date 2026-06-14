import { canViewDashboard } from "@/lib/dashboard/can-view-dashboard"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { applications, employees, goals, surveys } from "@/schema"
import { count, eq } from "drizzle-orm"

// GET /dashboard — 従業員・目標・申請・調査の横断的な集計
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canViewDashboard(session.role) === false) {
    throw new ForbiddenError()
  }

  const [employeeRows, openGoalRows, pendingApplicationRows, openSurveyRows] =
    await c.var.database.batch([
      c.var.database.select({ total: count() }).from(employees),
      c.var.database.select({ total: count() }).from(goals).where(eq(goals.status, "in_progress")),
      c.var.database
        .select({ total: count() })
        .from(applications)
        .where(eq(applications.status, "pending")),
      c.var.database.select({ total: count() }).from(surveys).where(eq(surveys.status, "open")),
    ])

  const body = {
    employee_count: employeeRows.at(0)?.total ?? 0,
    open_goal_count: openGoalRows.at(0)?.total ?? 0,
    pending_application_count: pendingApplicationRows.at(0)?.total ?? 0,
    open_survey_count: openSurveyRows.at(0)?.total ?? 0,
  }

  return c.json(body, 200)
})
