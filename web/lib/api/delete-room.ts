import { createClient } from "@/lib/api/hc-client"

// DELETE /rooms/:id。会議室を削除する（管理者ロールのみ）。
// 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function deleteRoom(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.rooms[":id"].$delete({ param: { id: String(id) } })

  if (response.status >= 400) {
    return new Error("failed to delete room")
  }

  return null
}
