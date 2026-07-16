import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// POST /assets/:code/dispose。物品を廃棄済みにする（管理者ロールのみ）。
export async function disposeAsset(code: string, reason: string, disposedOn?: string) {
  const client = await createClient()

  const response = await client.assets[":code"].dispose.$post({
    param: { code },
    json: { reason, disposed_on: disposedOn },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "物品の廃棄に失敗しました",
      conflictMessages: {
        "asset is lent": "貸与中の物品は廃棄できません",
        "asset is not in stock": "在庫にない物品は廃棄できません",
      },
    })
  }

  return response.json()
}
