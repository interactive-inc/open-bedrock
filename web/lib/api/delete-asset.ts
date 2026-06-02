import { createClient } from "@/lib/api/hc-client"

// DELETE /assets/:code。物品を削除する（管理者ロールのみ、貸与中は不可）。
// 権限不足は 403、不存在は 404、貸与中は 409 を api が返すため、戻りは Error になる。成功時は null。
export async function deleteAsset(code: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client.assets[":code"].$delete({ param: { code } })

  if (response.status >= 400) {
    return new Error("failed to delete asset")
  }

  return null
}
