import { createClient } from "@/lib/api/hc-client"
import type { ThanksRedemptionResponse } from "@/lib/api/types/thanks-points-types"

export type MyRedemptionsResult = {
  data: Array<ThanksRedemptionResponse>
  total: number
}

/**
 * GET /thanks-redemptions/me。自分の交換申請の一覧（新着順）を取得する。
 * API は { data: ThanksRedemptionResponse[], total: number } を返す。
 */
export async function getMyRedemptions(props?: {
  limit?: number
  offset?: number
}): Promise<MyRedemptionsResult | Error> {
  const client = await createClient()

  const query: Record<string, string> = {}

  if (props?.limit !== undefined) {
    query.limit = String(props.limit)
  }

  if (props?.offset !== undefined) {
    query.offset = String(props.offset)
  }

  const response = await client["thanks-redemptions"].me.$get({ query })

  if (response.status >= 400) {
    return new Error("failed to load my redemptions")
  }

  const body = await response.json()

  return { data: body.data, total: body.total }
}
