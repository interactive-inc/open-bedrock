import { createClient } from "@/lib/api/hc-client"
import type { ThanksResponse } from "@/lib/api/types/thanks-types"

export type ThanksListResult = {
  data: Array<ThanksResponse>
  total: number
}

/**
 * GET /thanks-messages。全従業員に公開された感謝のタイムライン（新着順）を取得する。
 * API は { data: ThanksResponse[], total: number } を返す。
 */
export async function getThanksList(props?: {
  limit?: number
  offset?: number
}): Promise<ThanksListResult | Error> {
  const client = await createClient()

  const query: Record<string, string> = {}

  if (props?.limit !== undefined) {
    query.limit = String(props.limit)
  }

  if (props?.offset !== undefined) {
    query.offset = String(props.offset)
  }

  const response = await client["thanks-messages"].$get({ query })

  if (response.status >= 400) {
    return new Error("failed to load thanks list")
  }

  const body = await response.json()

  return { data: body.data, total: body.total }
}
