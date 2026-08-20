import { buildDashboardMonthLabels } from "@/api/http/dashboard/build-dashboard-month-labels"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { goals } from "@/contexts/performance-review/infrastructure/schema/goal"
import { surveys } from "@/contexts/survey/infrastructure/schema/survey"
import type { Context } from "@/env"
import { countPendingSystemCases } from "@system/infrastructure/workflow/count-pending-system-cases"
import { listSystemCaseMonthlyCounts } from "@system/infrastructure/workflow/list-system-case-monthly-counts"
import { count, eq } from "drizzle-orm"

/** System・Company・評価・Surveyの集計を製品dashboard responseへ合成する。 */
export async function readDashboard(context: Context, now: string) {
  const monthLabels = buildDashboardMonthLabels(now)
  const firstMonth = monthLabels[0]
  if (firstMonth === undefined) return new Error("dashboard month window is empty")
  const windowStartDate = new Date(`${firstMonth}-01T00:00:00Z`)

  const [pendingApplicationCount, applicationTrendRows, dashboardRows] = await Promise.all([
    countPendingSystemCases({ env: { DB: context.env.DB } }),
    listSystemCaseMonthlyCounts({ env: { DB: context.env.DB } }, windowStartDate),
    context.var.database.batch([
      context.var.database.select({ total: count() }).from(employees),
      context.var.database
        .select({ total: count() })
        .from(goals)
        .where(eq(goals.status, "in_progress")),
      context.var.database
        .select({ total: count() })
        .from(surveys)
        .where(eq(surveys.status, "open")),
      context.var.database
        .select({ dept_name: employees.deptName, total: count() })
        .from(employees)
        .groupBy(employees.deptName),
      context.var.database
        .select({ status: goals.status, total: count() })
        .from(goals)
        .groupBy(goals.status),
    ]),
  ])
  if (pendingApplicationCount instanceof Error) return pendingApplicationCount
  if (applicationTrendRows instanceof Error) return applicationTrendRows
  const [employeeRows, openGoalRows, openSurveyRows, departmentRows, goalStatusRows] = dashboardRows
  const goalStatusCounts: Record<string, number> = {}
  let goalTotal = 0
  for (const row of goalStatusRows) {
    goalStatusCounts[row.status] = row.total
    goalTotal += row.total
  }
  const completedGoals = goalStatusCounts.completed ?? 0
  const trendByMonth = new Map(applicationTrendRows.map((row) => [row.month, row.total]))

  return {
    employee_count: employeeRows.at(0)?.total ?? 0,
    open_goal_count: openGoalRows.at(0)?.total ?? 0,
    pending_application_count: pendingApplicationCount,
    open_survey_count: openSurveyRows.at(0)?.total ?? 0,
    department_breakdown: departmentRows.map((row) => ({
      dept_name: row.dept_name ?? "未所属",
      count: row.total,
    })),
    goal_status_summary: {
      draft: goalStatusCounts.draft ?? 0,
      in_progress: goalStatusCounts.in_progress ?? 0,
      completed: completedGoals,
    },
    goal_completion_rate:
      goalTotal === 0 ? 0 : Math.round((completedGoals / goalTotal) * 1000) / 10,
    application_trend: monthLabels.map((month) => ({
      month,
      count: trendByMonth.get(month) ?? 0,
    })),
  }
}
