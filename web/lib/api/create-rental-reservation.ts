import { createClient } from "@/lib/api/hc-client"
import type { RentalReservationCreateRequest } from "@/lib/api/types/rental-types"

// POST /rentals。レンタル予約を申請する。失敗時は Error を返す。
export async function createRentalReservation(request: RentalReservationCreateRequest) {
  const client = await createClient()

  const response = await client.rentals.$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to create rental reservation")
  }

  return response.json()
}
