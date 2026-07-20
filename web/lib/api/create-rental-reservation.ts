import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { RentalReservationCreateRequest } from "@/lib/api/types/rental-types"

/** POST /rentals。レンタル予約を申請する。失敗時は Error を返す。 */
export async function createRentalReservation(request: RentalReservationCreateRequest) {
  const client = await createClient()

  const response = await client.rentals.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "レンタル予約の申請に失敗しました",
      conflictMessages: {
        "an overlapping rental reservation already exists":
          "期間が重複するレンタル予約が既にあります",
      },
    })
  }

  return response.json()
}
