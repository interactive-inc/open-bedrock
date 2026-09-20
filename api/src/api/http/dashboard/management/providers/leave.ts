import type {
  ManagementDashboardBusinessMetrics,
  ManagementDashboardMetricInput,
} from "@/api/http/dashboard/management/management-dashboard-business-metrics"
import { leaveProcedureStatusSql } from "@/contexts/leave/infrastructure/adapters/lib/leave-procedure-status-sql"
import { leaveRequests } from "@/contexts/leave/infrastructure/schema/leave"
import type { Context } from "@/env"
import { count, eq, like } from "drizzle-orm"

/** 対象月の休暇申請の件数と、承認待ちの件数。 */
export async function readManagementMetricsLeave(
  context: Context,
  input: ManagementDashboardMetricInput,
): Promise<Partial<ManagementDashboardBusinessMetrics>> {
  const database = context.var.database
  const [monthRows, pendingRows] = await database.batch([
    database
      .select({ total: count() })
      .from(leaveRequests)
      .where(like(leaveRequests.createdAt, input.monthLike)),
    database
      .select({ total: count() })
      .from(leaveRequests)
      .where(eq(leaveProcedureStatusSql, "pending")),
  ])
  return {
    leave_request_count: monthRows.at(0)?.total ?? 0,
    leave_pending_count: pendingRows.at(0)?.total ?? 0,
  }
}
