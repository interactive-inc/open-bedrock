import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type {
  RentalReservationResponse,
  RentalReservationUpdateRequest,
} from "@/lib/api/types/rental-types"

/**
 * PUT /rental-reservations/:id。レンタル予約の品名・期間・用途を変更する。
 * 本人以外は 403 を api が返すため、戻りは Error になる。
 */
export async function updateRentalReservation(
  id: string,
  request: RentalReservationUpdateRequest,
): Promise<RentalReservationResponse | Error> {
  const client = await createClient()

  const response = await client["rental"]["rental-reservations"][":id"].$put({
    param: { id },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "レンタル予約の変更に失敗しました",
      conflictMessages: {
        "an overlapping rental reservation already exists":
          "期間が重複するレンタル予約が既にあります",
        "reservation is not modifiable": "この予約は変更できません",
      },
    })
  }

  return response.json()
}
