import { createClient } from "@/lib/api/hc-client"

// DELETE /rentals/:id。レンタル予約を取消す。
// 本人以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function cancelRentalReservation(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client.rentals[":id"].$delete({
    param: { id },
  })

  if (response.status >= 400) {
    return new Error("failed to cancel rental reservation")
  }

  return null
}
