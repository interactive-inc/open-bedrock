import type {
  ManagementDashboardBusinessMetrics,
  ManagementDashboardMetricInput,
} from "@/api/http/dashboard/management/management-dashboard-business-metrics"
import { expenses } from "@/contexts/expense/infrastructure/schema/expense"
import type { Context } from "@/env"
import { count, eq, like } from "drizzle-orm"

/** 対象月の経費申請の件数と、承認待ちの件数。 */
export async function readManagementMetricsExpense(
  context: Context,
  input: ManagementDashboardMetricInput,
): Promise<Partial<ManagementDashboardBusinessMetrics>> {
  const database = context.var.database
  const [monthRows, pendingRows] = await database.batch([
    database
      .select({ total: count() })
      .from(expenses)
      .where(like(expenses.createdAt, input.monthLike)),
    database.select({ total: count() }).from(expenses).where(eq(expenses.status, "pending")),
  ])
  return {
    expense_count: monthRows.at(0)?.total ?? 0,
    expense_pending_count: pendingRows.at(0)?.total ?? 0,
  }
}
