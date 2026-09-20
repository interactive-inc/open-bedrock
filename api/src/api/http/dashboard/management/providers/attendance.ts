import type {
  ManagementDashboardBusinessMetrics,
  ManagementDashboardMetricInput,
} from "@/api/http/dashboard/management/management-dashboard-business-metrics"
import { attendanceRecords } from "@/contexts/attendance/infrastructure/schema/attendance"
import type { Context } from "@/env"
import { count, like } from "drizzle-orm"

/** 対象月の勤怠記録の件数。 */
export async function readManagementMetricsAttendance(
  context: Context,
  input: ManagementDashboardMetricInput,
): Promise<Partial<ManagementDashboardBusinessMetrics>> {
  const rows = await context.var.database
    .select({ total: count() })
    .from(attendanceRecords)
    .where(like(attendanceRecords.workDate, input.monthLike))
  return { attendance_record_count: rows.at(0)?.total ?? 0 }
}
