import { createClient } from "@/lib/api/hc-client"

// DELETE /rooms/reservations/:id。会議室予約をキャンセルする。
// 本人以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function cancelRoomReservation(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client.rooms.reservations[":id"].$delete({
    param: { id },
  })

  if (response.status >= 400) {
    return new Error("failed to cancel room reservation")
  }

  return null
}
