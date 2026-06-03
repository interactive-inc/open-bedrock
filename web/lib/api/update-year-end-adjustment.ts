import { createClient } from "@/lib/api/hc-client"
import type {
  YearEndAdjustmentResponse,
  YearEndAdjustmentUpdateRequest,
} from "@/lib/api/types/year-end-adjustment-types"

// PUT /year-end-adjustments/:id。年末調整申告の内容を変更する。本人以外は 403 を api が返すため、戻りは Error になる。
export async function updateYearEndAdjustment(
  id: string,
  request: YearEndAdjustmentUpdateRequest,
): Promise<YearEndAdjustmentResponse | Error> {
  const client = await createClient()

  const response = await client["year-end-adjustments"][":id"].$put({
    param: { id },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to update year end adjustment")
  }

  return response.json()
}
