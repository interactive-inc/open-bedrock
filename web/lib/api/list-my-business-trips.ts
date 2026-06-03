import { createClient } from "@/lib/api/hc-client"
import type { BusinessTripResponse } from "@/lib/api/types/business-trip-types"

// GET /business-trips/me。申請者本人の出張申請一覧を取得する。
export async function listMyBusinessTrips(): Promise<ReadonlyArray<BusinessTripResponse> | Error> {
  const client = await createClient()

  const response = await client["business-trips"].me.$get()

  if (response.status >= 400) {
    return new Error("failed to load business trips")
  }

  return response.json()
}
