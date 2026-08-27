import { createClient } from "@/lib/api/hc-client"
import type { ThanksResponse } from "@/lib/api/types/thanks-types"

export type MyThanksResult = {
  data: Array<ThanksResponse>
  total: number
}

/**
 * GET /thanks-messages/me。自分が送った感謝の一覧（新着順）を取得する。
 * API は { data: ThanksResponse[], total: number } を返す。
 */
export async function getMyThanks(props?: {
  limit?: number
  offset?: number
}): Promise<MyThanksResult | Error> {
  const client = await createClient()

  const query: Record<string, string> = {}

  if (props?.limit !== undefined) {
    query.limit = String(props.limit)
  }

  if (props?.offset !== undefined) {
    query.offset = String(props.offset)
  }

  const response = await client["thanks"]["thanks-messages"].me.$get({ query })

  if (response.status >= 400) {
    return new Error("failed to load my thanks")
  }

  const body = await response.json()

  return { data: body.data, total: body.total }
}
