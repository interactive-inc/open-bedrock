import { createClient } from "@/lib/api/hc-client"
import { ApiResponseError } from "@/lib/api/api-response-error"

/** GET /decision-records/:id を session トークン付きで呼び、意思決定記録詳細を取得する。 */
export async function getDecisionDetail(id: number) {
  const client = await createClient()

  const response = await client["decision-records"][":id"].$get({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new ApiResponseError(response.status, "failed to load decision detail")
  }

  return response.json()
}
