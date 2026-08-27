import { createClient } from "@/lib/api/hc-client"
import { ApiResponseError } from "@/lib/api/api-response-error"

/** GET /department-budgets/:id。1 件の予算詳細（消化額・残額を含む）を取得する。budget:manage が無いと 403。 */
export async function getBudgetDetail(id: number) {
  const client = await createClient()

  const response = await client["expense"]["department-budgets"][":id"].$get({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new ApiResponseError(response.status, "failed to load budget detail")
  }

  return response.json()
}
