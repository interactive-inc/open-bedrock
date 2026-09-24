import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ExpenseSubmitRequest } from "@/lib/api/types/expense-types"

/** POST /expenses。経費を新規申請する。 */
export async function submitExpense(request: ExpenseSubmitRequest) {
  const client = await createClient()

  try {
    const response = await client["expense"]["expenses"].$post({
      json: {
        ...request,
        existing_expense_id:
          request.existing_expense_id == null
            ? request.existing_expense_id
            : Number(request.existing_expense_id),
        previous_expense_id:
          request.previous_expense_id == null
            ? request.previous_expense_id
            : Number(request.previous_expense_id),
      },
    })

    if (response.status >= 400) {
      return toResponseError(response, { fallback: "経費申請の作成に失敗しました" })
    }

    return await response.json()
  } catch {
    return new Error(
      "提出結果を確認できません。一覧で結果を確認するか、同じ内容で再試行してください",
    )
  }
}
