import { createClient } from "@/lib/api/hc-client"
import { ApiResponseError } from "@/lib/api/api-response-error"

/** GET /stocktakes/:id。棚卸しセッション 1 件の詳細（確認状況を含む）。 */
export async function getStocktake(id: string) {
  const client = await createClient()

  const response = await client["asset"]["stocktakes"][":id"].$get({ param: { id } })

  if (response.status >= 400) {
    return new ApiResponseError(response.status, "failed to load stocktake")
  }

  return response.json()
}
