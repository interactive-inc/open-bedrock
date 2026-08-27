import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /stocktakes/:id/assets/:code/check。資産の現物確認を記録する（管理者ロールのみ）。 */
export async function checkStocktakeItem(id: string, assetCode: string, locationNote?: string) {
  const client = await createClient()

  const response = await client["asset"]["stocktakes"][":id"].assets[":code"].check.$post({
    param: { id, code: assetCode },
    json: { location_note: locationNote },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "現物確認の記録に失敗しました",
      conflictMessages: {
        "stocktake is not open": "締め済みの棚卸しには記録できません",
      },
    })
  }

  return response.json()
}
