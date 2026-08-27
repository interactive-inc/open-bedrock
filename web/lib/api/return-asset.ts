import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /assets/:code/return。貸与中の物品を返却して在庫へ戻す（管理者ロールのみ）。 */
export async function returnAsset(code: string) {
  const client = await createClient()

  const response = await client["asset"]["assets"][":code"].return.$post({
    param: { code },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "物品の返却に失敗しました",
      conflictMessages: {
        "asset is not lent": "貸与中でない物品は返却できません",
      },
    })
  }

  return response.json()
}
