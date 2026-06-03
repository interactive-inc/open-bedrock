import { createClient } from "@/lib/api/hc-client"
import type {
  BusinessTripResponse,
  BusinessTripUpdateRequest,
} from "@/lib/api/types/business-trip-types"

// PUT /business-trips/:id。出張申請の内容を変更する。本人以外は 403 を api が返すため、戻りは Error になる。
export async function updateBusinessTrip(
  id: string,
  request: BusinessTripUpdateRequest,
): Promise<BusinessTripResponse | Error> {
  const client = await createClient()

  const response = await client["business-trips"][":id"].$put({
    param: { id },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to update business trip")
  }

  return response.json()
}
