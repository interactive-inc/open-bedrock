import { createClient } from "@/lib/api/hc-client"
import type { YearEndAdjustmentCreateRequest } from "@/lib/api/types/year-end-adjustment-types"

// POST /year-end-adjustments。年末調整の申告を作成する。status は submitted で登録される。
export async function createYearEndAdjustment(request: YearEndAdjustmentCreateRequest) {
  const client = await createClient()

  const response = await client["year-end-adjustments"].$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to create year end adjustment")
  }

  return response.json()
}
