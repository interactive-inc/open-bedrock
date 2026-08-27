import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * POST /rental-reservations/:id/lend。貸与品予約を貸出済みにする。
 * 権限なしは 403、不存在は 404、遷移不可は 409 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function lendRentalReservation(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["rental"]["rental-reservations"][":id"].lend.$post({
    param: { id },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "貸与品の貸出に失敗しました",
      conflictMessages: {
        "rental reservation is not in a transitionable state": "この予約は貸出できません",
      },
    })
  }

  return null
}
