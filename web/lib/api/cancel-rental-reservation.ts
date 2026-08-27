import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * DELETE /rental-reservations/:id。レンタル予約を取消す。
 * 本人以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function cancelRentalReservation(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["rental"]["rental-reservations"][":id"].$delete({
    param: { id },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "レンタル予約の取消に失敗しました",
      conflictMessages: {
        "reservation is not modifiable": "この予約は取消できません",
      },
    })
  }

  return null
}
