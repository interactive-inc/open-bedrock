// このファイルは `bun run gen:composition` が生成する。手で編集しない。
import { readDashboardMetricsPerformanceReview } from "@/api/http/dashboard/providers/performance-review"
import { readDashboardMetricsSurvey } from "@/api/http/dashboard/providers/survey"

/** 業務contextごとのdashboardの値の取得。src/api/http/dashboard/providers/*.ts から生成する。 */
export const DASHBOARD_METRIC_PROVIDERS = [
  readDashboardMetricsPerformanceReview,
  readDashboardMetricsSurvey,
] as const
