import { createClient } from "@/lib/api/hc-client"
import type { RentalReservationResponse } from "@/lib/api/types/rental-types"

// GET /rentals/me。申請者本人のレンタル予約一覧を取得する。
export async function listMyRentalReservations(): Promise<
  ReadonlyArray<RentalReservationResponse> | Error
> {
  const client = await createClient()

  const response = await client.rentals.me.$get()

  if (response.status >= 400) {
    return new Error("failed to load rental reservations")
  }

  const body = await response.json()

  return body.data
}
