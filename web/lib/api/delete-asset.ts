import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// DELETE /assets/:code。物品を削除する（管理者ロールのみ、貸与中は不可）。
// 権限不足は 403、不存在は 404、貸与中は 409 を api が返すため、戻りは Error になる。成功時は null。
export async function deleteAsset(code: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client.assets[":code"].$delete({ param: { code } })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "物品の削除に失敗しました",
      conflictMessages: {
        "asset is currently lent": "貸与中の物品は削除できません",
      },
    })
  }

  return null
}
