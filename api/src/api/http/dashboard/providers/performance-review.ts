import type { DashboardBusinessMetrics } from "@/api/http/dashboard/dashboard-business-metrics"
import { goals } from "@/contexts/performance-review/infrastructure/schema/goal"
import type { Context } from "@/env"
import { count, eq } from "drizzle-orm"

/** 進行中の目標の件数と、状態別の件数から出す完了率。 */
export async function readDashboardMetricsPerformanceReview(
  context: Context,
): Promise<Partial<DashboardBusinessMetrics>> {
  const [openGoalRows, goalStatusRows] = await context.var.database.batch([
    context.var.database
      .select({ total: count() })
      .from(goals)
      .where(eq(goals.status, "in_progress")),
    context.var.database
      .select({ status: goals.status, total: count() })
      .from(goals)
      .groupBy(goals.status),
  ])
  const goalStatusCounts: Record<string, number> = {}
  let goalTotal = 0
  for (const row of goalStatusRows) {
    goalStatusCounts[row.status] = row.total
    goalTotal += row.total
  }
  const completedGoals = goalStatusCounts.completed ?? 0
  return {
    open_goal_count: openGoalRows.at(0)?.total ?? 0,
    goal_status_summary: {
      draft: goalStatusCounts.draft ?? 0,
      in_progress: goalStatusCounts.in_progress ?? 0,
      completed: completedGoals,
    },
    goal_completion_rate:
      goalTotal === 0 ? 0 : Math.round((completedGoals / goalTotal) * 1000) / 10,
  }
}
