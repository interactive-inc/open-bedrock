import { createClient } from "@/lib/api/hc-client"
import type { StocktakeStatus } from "@/lib/api/types/stocktake-types"

/** GET /stocktakes。棚卸しセッション一覧。status で絞り込み可能。 */
export async function getStocktakeList(status: StocktakeStatus | null) {
  const client = await createClient()

  const response = await client["asset"]["stocktakes"].$get({
    query: { status: status ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load stocktakes")
  }

  const body = await response.json()

  return body.data
}
