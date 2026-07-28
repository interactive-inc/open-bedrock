import { createClient } from "@/lib/api/hc-client"
import { ApiResponseError } from "@/lib/api/api-response-error"

/** GET /partners/:code。取引先 1 件の詳細。 */
export async function getPartnerByCode(code: string) {
  const client = await createClient()

  const response = await client.partners[":code"].$get({ param: { code } })

  if (response.status >= 400) {
    return new ApiResponseError(response.status, "failed to load partner")
  }

  return response.json()
}
