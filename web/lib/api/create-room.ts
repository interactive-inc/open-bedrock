import { createClient } from "@/lib/api/hc-client"
import type { RoomCreateRequest } from "@/lib/api/types/room-types"

/** POST /rooms。会議室を新規登録する（管理者ロールのみ）。 */
export async function createRoom(request: RoomCreateRequest) {
  const client = await createClient()

  const response = await client.rooms.$post({ json: request })

  if (response.status >= 400) {
    return new Error("会議室の登録に失敗しました")
  }

  return response.json()
}
