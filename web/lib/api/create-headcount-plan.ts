import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// POST /headcount-plans。人員計画を登録する（headcount_plan:manage）。年度・部署の重複は 409。
export async function createHeadcountPlan(request: {
  fiscal_year: number
  department_code: string | null
  planned_count: number
  note: string | null
}) {
  const client = await createClient()

  const response = await client["headcount-plans"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "人員計画の登録に失敗しました",
      conflictMessages: {
        "headcount plan already exists": "この年度・部署の人員計画は既に登録されています",
      },
    })
  }

  return response.json()
}
