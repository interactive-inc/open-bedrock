import type { DashboardBusinessMetrics } from "@/api/http/dashboard/dashboard-business-metrics"
import { surveys } from "@/contexts/survey/infrastructure/schema/survey"
import type { Context } from "@/env"
import { count, eq } from "drizzle-orm"

/** 回答受付中のサーベイの件数。 */
export async function readDashboardMetricsSurvey(
  context: Context,
): Promise<Partial<DashboardBusinessMetrics>> {
  const rows = await context.var.database
    .select({ total: count() })
    .from(surveys)
    .where(eq(surveys.status, "open"))
  return { open_survey_count: rows.at(0)?.total ?? 0 }
}
