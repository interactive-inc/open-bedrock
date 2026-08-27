import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { BusinessTripCreateRequest } from "@/lib/api/types/business-trip-types"

/** POST /business-trips。出張申請を作成する。status は requested で登録される。 */
export async function createBusinessTrip(request: BusinessTripCreateRequest) {
  const client = await createClient()

  const response = await client["business-trip"]["business-trips"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "出張申請の作成に失敗しました",
      conflictMessages: {
        "overlapping business trip already exists": "期間が重複する出張申請が既にあります",
      },
    })
  }

  return response.json()
}
