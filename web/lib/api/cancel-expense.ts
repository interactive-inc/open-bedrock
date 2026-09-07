import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ExpenseDecisionTarget } from "@/lib/api/types/expense-types"

/** 確認した経費を取り消す。 */
export async function cancelExpense(id: number, target: ExpenseDecisionTarget) {
  const client = await createClient()
  const response = await client.expense["expenses"][":id"].cancel.$post({
    param: { id: String(id) },
    json: { decision_target: target },
  })
  if (response.status >= 400) return toResponseError(response, { fallback: "経費を取り消せません" })
  return response.json()
}
