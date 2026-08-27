import { createClient } from "@/lib/api/hc-client"
import { ApiResponseError } from "@/lib/api/api-response-error"

/** GET /knowledge-articles/:id を session トークン付きで呼び、記事詳細を取得する。 */
export async function getKnowledgeDetail(id: number) {
  const client = await createClient()

  const response = await client["knowledge"]["knowledge-articles"][":id"].$get({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new ApiResponseError(response.status, "failed to load knowledge detail")
  }

  return response.json()
}
