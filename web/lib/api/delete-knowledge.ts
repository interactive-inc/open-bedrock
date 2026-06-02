import { createClient } from "@/lib/api/hc-client"

// DELETE /knowledge/:id。記事を削除する。作成者以外は 403、不存在は 404 を api が返すため戻りは Error。成功時は null。
export async function deleteKnowledge(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.knowledge[":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to delete knowledge")
  }

  return null
}
