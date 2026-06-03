import { createClient } from "@/lib/api/hc-client"
import type { BusinessTripCreateRequest } from "@/lib/api/types/business-trip-types"

// POST /business-trips。出張申請を作成する。status は requested で登録される。
export async function createBusinessTrip(request: BusinessTripCreateRequest) {
  const client = await createClient()

  const response = await client["business-trips"].$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to create business trip")
  }

  return response.json()
}
