import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { RoomReservationCreateRequest } from "@/lib/api/types/room-types"

/**
 * POST /rooms/reservations。会議室の予約を作成する。
 * 期間が既存予約と重複する場合は api が 409 を返すため、戻りは Error になる。
 */
export async function createRoomReservation(request: RoomReservationCreateRequest) {
  const client = await createClient()

  const response = await client.rooms.reservations.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "会議室予約の作成に失敗しました",
      conflictMessages: {
        "the room is already reserved": "この時間帯の会議室は既に予約されています",
      },
    })
  }

  return response.json()
}
