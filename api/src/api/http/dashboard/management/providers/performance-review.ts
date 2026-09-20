import type { ManagementDashboardBusinessMetrics } from "@/api/http/dashboard/management/management-dashboard-business-metrics"
import { goals } from "@/contexts/performance-review/infrastructure/schema/goal"
import { reviewCycles } from "@/contexts/performance-review/infrastructure/schema/performance-review"
import type { Context } from "@/env"
import { count, eq } from "drizzle-orm"

/** 実施中の評価cycleの件数と、period ごとの目標の done 率(0-1)。 */
export async function readManagementMetricsPerformanceReview(
  context: Context,
): Promise<Partial<ManagementDashboardBusinessMetrics>> {
  const database = context.var.database
  const [openCycleRows, goalRows] = await database.batch([
    database.select({ total: count() }).from(reviewCycles).where(eq(reviewCycles.status, "open")),
    database
      .select({ period: goals.period, status: goals.status, total: count() })
      .from(goals)
      .groupBy(goals.period, goals.status),
  ])
  const totalsByPeriod = new Map<string, { total: number; done: number }>()
  for (const row of goalRows) {
    const entry = totalsByPeriod.get(row.period) ?? { total: 0, done: 0 }
    const done = row.status === "done" ? entry.done + row.total : entry.done
    totalsByPeriod.set(row.period, { total: entry.total + row.total, done })
  }
  const rates = [...totalsByPeriod].map(([period, value]) => ({
    period,
    total: value.total,
    done: value.done,
    done_rate: value.total === 0 ? 0 : value.done / value.total,
  }))
  rates.sort((a, b) => (a.period < b.period ? 1 : -1))
  return { open_review_cycle_count: openCycleRows.at(0)?.total ?? 0, goal_done_rates: rates }
}
