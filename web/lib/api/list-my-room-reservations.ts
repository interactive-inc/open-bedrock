import { createClient } from "@/lib/api/hc-client"
import type { RoomReservationResponse } from "@/lib/api/types/room-types"

/** GET /rooms/reservations/me。予約者本人の会議室予約一覧を取得する。 */
export async function listMyRoomReservations(): Promise<
  ReadonlyArray<RoomReservationResponse> | Error
> {
  const client = await createClient()

  const response = await client["room"]["rooms"].reservations.me.$get()

  if (response.status >= 400) {
    return new Error("failed to load room reservations")
  }

  const body = await response.json()

  return body.data
}
