import { createClient } from "@/lib/api/hc-client"
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
    return new Error("failed to correct salary revision")
  }

  return response.json()
}
