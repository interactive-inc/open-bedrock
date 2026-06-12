import { createClient } from "@/lib/api/hc-client"
import type { OneOnOneUpdateRequest } from "@/lib/api/types/oneonone-types"

// PUT /oneonones/:id。1on1 の記録内容を変更する。
// 記録した上長以外は 403、不存在は 404 を api が返すため、戻りは Error になる。
export async function updateOneOnOne(id: string, request: OneOnOneUpdateRequest) {
  const client = await createClient()

  const response = await client.oneonones[":id"].$put({
    param: { id },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("1on1記録の変更に失敗しました")
  }

  return response.json()
}
