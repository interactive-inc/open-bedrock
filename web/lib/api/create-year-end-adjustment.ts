import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { YearEndAdjustmentCreateRequest } from "@/lib/api/types/year-end-adjustment-types"

// POST /year-end-adjustments。年末調整の申告を作成する。status は submitted で登録される。
export async function createYearEndAdjustment(request: YearEndAdjustmentCreateRequest) {
  const client = await createClient()

  const response = await client["year-end-adjustments"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "年末調整の申告に失敗しました",
      conflictMessages: {
        "already submitted for this year": "同一年度の年末調整は既に提出されています",
      },
    })
  }

  return response.json()
}
