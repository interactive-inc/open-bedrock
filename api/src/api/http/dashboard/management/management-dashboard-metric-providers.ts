// このファイルは `bun run gen:composition` が生成する。手で編集しない。
import { readManagementMetricsAttendance } from "@/api/http/dashboard/management/providers/attendance"
import { readManagementMetricsExpense } from "@/api/http/dashboard/management/providers/expense"
import { readManagementMetricsLeave } from "@/api/http/dashboard/management/providers/leave"
import { readManagementMetricsPerformanceReview } from "@/api/http/dashboard/management/providers/performance-review"

/** 業務contextごとの経営dashboardの値の取得。src/api/http/dashboard/management/providers/*.ts から生成する。 */
export const MANAGEMENT_DASHBOARD_METRIC_PROVIDERS = [
  readManagementMetricsAttendance,
  readManagementMetricsExpense,
  readManagementMetricsLeave,
  readManagementMetricsPerformanceReview,
] as const
