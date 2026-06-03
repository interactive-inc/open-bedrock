import { createClient } from "@/lib/api/hc-client"
import type {
  RoomReservationResponse,
  RoomReservationUpdateRequest,
} from "@/lib/api/types/room-types"

// PUT /rooms/reservations/:id。会議室予約の時刻と用途を変更する。
// 本人以外は 403、時間帯重複は 409 を api が返すため、戻りは Error になる。
export async function updateRoomReservation(
  id: string,
  request: RoomReservationUpdateRequest,
): Promise<RoomReservationResponse | Error> {
  const client = await createClient()

  const response = await client.rooms.reservations[":id"].$put({
    param: { id },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to update room reservation")
  }

  return response.json()
}
