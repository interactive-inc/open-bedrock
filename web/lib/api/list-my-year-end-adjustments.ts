import { createClient } from "@/lib/api/hc-client"
import type { YearEndAdjustmentResponse } from "@/lib/api/types/year-end-adjustment-types"

// GET /year-end-adjustments/me。本人の年末調整申告一覧を取得する。
export async function listMyYearEndAdjustments(): Promise<
  ReadonlyArray<YearEndAdjustmentResponse> | Error
> {
  const client = await createClient()

  const response = await client["year-end-adjustments"].me.$get()

  if (response.status >= 400) {
    return new Error("failed to load year end adjustments")
  }

  const body = await response.json()

  return body.data
}
