import { createClient } from "@/lib/api/hc-client"
import { ApiResponseError } from "@/lib/api/api-response-error"

/** GET /assets/:code。物品 1 件の詳細。 */
export async function getAssetByCode(code: string) {
  const client = await createClient()

  const response = await client["asset"]["assets"][":code"].$get({ param: { code } })

  if (response.status >= 400) {
    return new ApiResponseError(response.status, "failed to load asset")
  }

  return response.json()
}
