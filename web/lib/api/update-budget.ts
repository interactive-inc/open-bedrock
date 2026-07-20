import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { BudgetMutatedResponse, BudgetUpdateRequest } from "@/lib/api/types/budget-types"

/** PATCH /budgets/:id。予算の金額・名称・メモを変更する。budget:manage が無いと 403、不存在は 404。 */
export async function updateBudget(
  id: number,
  request: BudgetUpdateRequest,
): Promise<BudgetMutatedResponse | Error> {
  const client = await createClient()

  const response = await client.budgets[":id"].$patch({
    param: { id: String(id) },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "予算の変更に失敗しました" })
  }

  return response.json()
}
