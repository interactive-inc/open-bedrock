import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ExpenseDecisionTarget } from "@/lib/api/types/expense-types"

/** 確認した経費を確定する。 */
export async function executeExpense(id: number, target: ExpenseDecisionTarget) {
  const client = await createClient()
  const response = await client.expense["expenses"][":id"].execute.$post({
    param: { id: String(id) },
    json: { decision_target: target },
  })
  if (response.status >= 400) return toResponseError(response, { fallback: "経費を確定できません" })
  return response.json()
}
