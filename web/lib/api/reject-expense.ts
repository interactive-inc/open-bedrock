import type { ExpenseDecisionTarget } from "@/lib/api/types/expense-types"
import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /expenses/:id/reject。任意コメント付きで経費を却下する。表示した判断対象と会社上の判断資格を検査する。 */
export async function rejectExpense(
  id: number,
  comment: string | null,
  decisionTarget: ExpenseDecisionTarget,
) {
  const client = await createClient()

  const response = await client["expense"]["expenses"][":id"].reject.$post({
    param: { id: String(id) },
    json: { comment: comment, decision_target: decisionTarget },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "経費の却下に失敗しました",
      conflictMessages: {
        "expense request already decided": "この経費は既に決定済みです",
      },
    })
  }

  return response.json()
}
