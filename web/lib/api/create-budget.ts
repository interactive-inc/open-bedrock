import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { BudgetCreateRequest } from "@/lib/api/types/budget-types"

// POST /budgets。部署予算を登録する。budget:manage が無いと 403。
export async function createBudget(request: BudgetCreateRequest) {
  const client = await createClient()

  const response = await client.budgets.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "予算の登録に失敗しました" })
  }

  return response.json()
}
