import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /stocktakes/:id/close。棚卸しセッションを締める（管理者ロールのみ）。 */
export async function closeStocktake(id: string) {
  const client = await createClient()

  const response = await client["asset"]["stocktakes"][":id"].close.$post({ param: { id } })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "棚卸しの締めに失敗しました",
      conflictMessages: {
        "stocktake is not open": "すでに締め済みの棚卸しです",
      },
    })
  }

  return response.json()
}
