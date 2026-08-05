import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { SalaryRevisionCreateRequest } from "@/lib/api/types/salary-revision-types"

/**
 * POST /salary-revisions。給与改定の事実記録を登録する。
 * 戻りは作成された記録 or Error。呼び出し元は instanceof Error で判別する。
 */
export async function createSalaryRevision(request: SalaryRevisionCreateRequest) {
  const client = await createClient()

  const response = await client["salary-revisions"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "給与改定の記録に失敗しました",
      conflictMessages: {
        "salary revision for this date already exists":
          "同じ適用日の給与改定が既に記録されています",
      },
    })
  }

  return response.json()
}
