import { createClient } from "@/lib/api/hc-client"

/**
 * GET /department-budgets/summary。会計期間を指定し、部署ごとの予算・消化額・残額を横断で取得する。
 * budget:manage が無いと 403。
 */
export async function getBudgetSummary(fiscalPeriod: string) {
  const client = await createClient()

  const response = await client["department-budgets"].summary.$get({
    query: { fiscal_period: fiscalPeriod },
  })

  if (response.status >= 400) {
    return new Error("failed to load budget summary")
  }

  const body = await response.json()
  return body.data
}
