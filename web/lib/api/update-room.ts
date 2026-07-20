import { createClient } from "@/lib/api/hc-client"
import type { RoomUpdateRequest } from "@/lib/api/types/room-types"

/**
 * PUT /rooms/:id。会議室の名称・定員・所在地を変更する（管理者ロールのみ）。
 * 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。
 */
export async function updateRoom(id: number, request: RoomUpdateRequest) {
  const client = await createClient()

  const response = await client.rooms[":id"].$put({ param: { id: String(id) }, json: request })

  if (response.status >= 400) {
    return new Error("会議室の変更に失敗しました")
  }

  return response.json()
}
