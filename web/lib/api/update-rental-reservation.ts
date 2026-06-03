import { createClient } from "@/lib/api/hc-client"
import type {
  RentalReservationResponse,
  RentalReservationUpdateRequest,
} from "@/lib/api/types/rental-types"

// PUT /rentals/:id。レンタル予約の品名・期間・用途を変更する。
// 本人以外は 403 を api が返すため、戻りは Error になる。
export async function updateRentalReservation(
  id: string,
  request: RentalReservationUpdateRequest,
): Promise<RentalReservationResponse | Error> {
  const client = await createClient()

  const response = await client.rentals[":id"].$put({
    param: { id },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to update rental reservation")
  }

  return response.json()
}
