import { buildDashboardMonthLabels } from "@/api/http/dashboard/build-dashboard-month-labels"
import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"
import { goals } from "@/contexts/performance-review/infrastructure/schema/goal"
import { surveys } from "@/contexts/survey/infrastructure/schema/survey"
import type { Context } from "@/env"
import { CountPendingSystemCasesAdapter } from "@system/infrastructure/adapters/workflow/count-pending-system-cases.adapter"
import { ListSystemCaseMonthlyCountsAdapter } from "@system/infrastructure/adapters/workflow/list-system-case-monthly-counts.adapter"
import { count, eq } from "drizzle-orm"

/** System・Company・評価・Surveyの集計を製品dashboard responseへ合成する。 */
export async function readDashboard(context: Context, now: string) {
  const monthLabels = buildDashboardMonthLabels(now)
  const firstMonth = monthLabels[0]
  if (firstMonth === undefined) return new Error("dashboard month window is empty")
  const windowStartDate = new Date(`${firstMonth}-01T00:00:00Z`)

  const [pendingApplicationCount, applicationTrendRows, companySnapshot, dashboardRows] =
    await Promise.all([
      new CountPendingSystemCasesAdapter({ env: { DB: context.env.DB } }).countPendingSystemCases(),
      new ListSystemCaseMonthlyCountsAdapter({
        env: { DB: context.env.DB },
      }).listSystemCaseMonthlyCounts(windowStartDate),
      new ReadCanonicalOrganizationStateAdapter(context).readCanonicalOrganizationState(),
      context.var.database.batch([
        context.var.database
          .select({ total: count() })
          .from(goals)
          .where(eq(goals.status, "in_progress")),
        context.var.database
          .select({ total: count() })
          .from(surveys)
          .where(eq(surveys.status, "open")),
        context.var.database
          .select({ status: goals.status, total: count() })
          .from(goals)
          .groupBy(goals.status),
      ]),
    ])
  if (pendingApplicationCount instanceof Error) return pendingApplicationCount
  if (applicationTrendRows instanceof Error) return applicationTrendRows
  if (companySnapshot instanceof Error) return companySnapshot
  const [openGoalRows, openSurveyRows, goalStatusRows] = dashboardRows
  const unitById = new Map(
    companySnapshot.organization.units.map((unit) => [unit.organizationUnitId, unit]),
  )
  const departmentCounts = new Map<string, number>()
  const activeStates = companySnapshot.employees.filter((state) => state.status === "ACTIVE")
  for (const state of activeStates) {
    const name =
      state.primaryAssignment === null
        ? "未所属"
        : (unitById.get(state.primaryAssignment.organizationUnitId)?.officialName ?? "未所属")
    departmentCounts.set(name, (departmentCounts.get(name) ?? 0) + 1)
  }
  const goalStatusCounts: Record<string, number> = {}
  let goalTotal = 0
  for (const row of goalStatusRows) {
    goalStatusCounts[row.status] = row.total
    goalTotal += row.total
  }
  const completedGoals = goalStatusCounts.completed ?? 0
  const trendByMonth = new Map(applicationTrendRows.map((row) => [row.month, row.total]))

  return {
    employee_count: activeStates.length,
    open_goal_count: openGoalRows.at(0)?.total ?? 0,
    pending_application_count: pendingApplicationCount,
    open_survey_count: openSurveyRows.at(0)?.total ?? 0,
    department_breakdown: [...departmentCounts].map(([dept_name, count]) => ({
      dept_name,
      count,
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
