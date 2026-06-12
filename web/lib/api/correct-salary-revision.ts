import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { SalaryRevisionCorrectRequest } from "@/lib/api/types/payroll-types"

// PUT /salary-revisions/:id。特権ロールが既存の給与改定を訂正する。
// api 側で特権ロール限定のため、権限不足時は 403 でエラーになる。
export async function correctSalaryRevision(id: number, request: SalaryRevisionCorrectRequest) {
  const client = await createClient()

  const response = await client["salary-revisions"][":id"].$put({
    param: { id: String(id) },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "給与改定の訂正に失敗しました",
      conflictMessages: {
        "effective date already exists for this employee": "既にこの適用日の給与改定が存在します",
      },
    })
  }

  return response.json()
}
