import { createClient } from "@/lib/api/hc-client"
import type { RoomReservationCreateRequest } from "@/lib/api/types/room-types"

// POST /rooms/reservations。会議室の予約を作成する。
// 期間が既存予約と重複する場合は api が 409 を返すため、戻りは Error になる。
export async function createRoomReservation(request: RoomReservationCreateRequest) {
  const client = await createClient()

  const response = await client.rooms.reservations.$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to create room reservation")
  }

  return response.json()
}
