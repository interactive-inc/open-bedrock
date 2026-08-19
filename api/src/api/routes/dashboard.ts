import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { goals } from "@/contexts/performance-review/infrastructure/schema/goal"
import { surveys } from "@/contexts/survey/infrastructure/schema/survey"
import { countPendingSystemCases } from "@system/infrastructure/workflow/count-pending-system-cases"
import { listSystemCaseMonthlyCounts } from "@system/infrastructure/workflow/list-system-case-monthly-counts"
import { count, eq } from "drizzle-orm"

/**
 * NOW から 6 か月分の YYYY-MM ラベルを古い順に返す（当月を含む）。
 * 例: NOW が 2026-06-15 なら ["2026-01","2026-02",...,"2026-06"]
 */
function buildMonthLabels(now: string): string[] {
  const d = new Date(now)
  const labels: string[] = []

  for (let i = 5; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1))
    const yyyy = String(m.getUTCFullYear())
    const mm = String(m.getUTCMonth() + 1).padStart(2, "0")
    labels.push(`${yyyy}-${mm}`)
  }

  return labels
}

// @authorization permission - 権限キーで判定する
/** GET /dashboard — 従業員・目標・申請・調査の横断的な集計 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("dashboard:view") === false) {
    throw new ForbiddenError()
  }

  const now = c.env.NOW ?? new Date().toISOString()
  const monthLabels = buildMonthLabels(now)
  const windowStart = `${monthLabels[0]}-01T00:00:00`
  const windowStartDate = new Date(`${windowStart}Z`)

  const [pendingApplicationCount, applicationTrendRows, dashboardRows] = await Promise.all([
    countPendingSystemCases({ env: { DB: c.env.DB } }),
    listSystemCaseMonthlyCounts({ env: { DB: c.env.DB } }, windowStartDate),
    c.var.database.batch([
      c.var.database.select({ total: count() }).from(employees),
      c.var.database.select({ total: count() }).from(goals).where(eq(goals.status, "in_progress")),
      c.var.database.select({ total: count() }).from(surveys).where(eq(surveys.status, "open")),
      c.var.database
        .select({ dept_name: employees.deptName, total: count() })
        .from(employees)
        .groupBy(employees.deptName),
      c.var.database
        .select({ status: goals.status, total: count() })
        .from(goals)
        .groupBy(goals.status),
    ]),
  ])
  if (pendingApplicationCount instanceof Error) throw pendingApplicationCount
  if (applicationTrendRows instanceof Error) throw applicationTrendRows
  const [employeeRows, openGoalRows, openSurveyRows, deptBreakdownRows, goalStatusRows] =
    dashboardRows

  // 部署別内訳（dept_name が null の行は "未所属" にまとめる）
  const department_breakdown = deptBreakdownRows.map((row) => ({
    dept_name: row.dept_name ?? "未所属",
    count: row.total,
  }))

  // 目標ステータス別集計 → 完了率を算出
  const goalStatusMap: Record<string, number> = {}
  let goalTotal = 0

  for (const row of goalStatusRows) {
    goalStatusMap[row.status] = row.total
    goalTotal += row.total
  }

  const goal_status_summary = {
    draft: goalStatusMap["draft"] ?? 0,
    in_progress: goalStatusMap["in_progress"] ?? 0,
    completed: goalStatusMap["completed"] ?? 0,
  }

  const goal_completion_rate =
    goalTotal === 0 ? 0 : Math.round(((goalStatusMap["completed"] ?? 0) / goalTotal) * 1000) / 10

  // 月別申請推移（空月は 0 で埋める）
  const trendMap = new Map(applicationTrendRows.map((row) => [row.month, row.total]))
  const application_trend = monthLabels.map((month) => ({
    month,
    count: trendMap.get(month) ?? 0,
  }))

  const body = {
    employee_count: employeeRows.at(0)?.total ?? 0,
    open_goal_count: openGoalRows.at(0)?.total ?? 0,
    pending_application_count: pendingApplicationCount,
    open_survey_count: openSurveyRows.at(0)?.total ?? 0,
    department_breakdown,
    goal_status_summary,
    goal_completion_rate,
    application_trend,
  }

  return c.json(body, 200)
})
