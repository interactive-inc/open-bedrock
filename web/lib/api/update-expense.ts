import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ExpenseUpdatedResponse, ExpenseUpdateRequest } from "@/lib/api/types/expense-types"

// PUT /expenses/:id。経費の申請内容を変更する。
// 本人以外は 403、pending 以外は 409 を api が返すため、戻りは Error になる。
export async function updateExpense(
  id: number,
  request: ExpenseUpdateRequest,
): Promise<ExpenseUpdatedResponse | Error> {
  const client = await createClient()

  const response = await client.expenses[":id"].$put({
    param: { id: String(id) },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "経費申請の変更に失敗しました",
      conflictMessages: {
        "the expense is not editable": "この経費申請は変更できません",
      },
    })
  }

  return response.json()
}
