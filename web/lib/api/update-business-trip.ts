import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type {
  BusinessTripResponse,
  BusinessTripUpdateRequest,
} from "@/lib/api/types/business-trip-types"

// PUT /business-trips/:id。出張申請の内容を変更する。本人以外は 403 を api が返すため、戻りは Error になる。
export async function updateBusinessTrip(
  id: string,
  request: BusinessTripUpdateRequest,
): Promise<BusinessTripResponse | Error> {
  const client = await createClient()

  const response = await client["business-trips"][":id"].$put({
    param: { id },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "出張申請の変更に失敗しました",
      conflictMessages: {
        "not modifiable": "この出張申請は変更できません",
        "overlapping business trip already exists": "期間が重複する出張申請が既にあります",
      },
    })
  }

  return response.json()
}
