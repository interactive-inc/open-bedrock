import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { SalaryRevisionCreateRequest } from "@/lib/api/types/payroll-types"

// POST /salary-revisions。特権ロールが給与改定を作成する。
export async function createSalaryRevision(request: SalaryRevisionCreateRequest) {
  const client = await createClient()

  const response = await client["salary-revisions"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "給与改定の作成に失敗しました",
      conflictMessages: {
        既にこの適用日の給与改定が存在します: "既にこの適用日の給与改定が存在します",
      },
    })
  }

  return response.json()
}
