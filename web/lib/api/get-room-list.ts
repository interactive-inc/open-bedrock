import { createClient } from "@/lib/api/hc-client"

/** GET /rooms。会議室マスタ一覧。閲覧はログイン済みの全ロール。 */
export async function getRoomList() {
  const client = await createClient()

  const response = await client.rooms.$get()

  if (response.status >= 400) {
    return new Error("failed to load rooms")
  }

  const body = await response.json()

  return body.data
}
