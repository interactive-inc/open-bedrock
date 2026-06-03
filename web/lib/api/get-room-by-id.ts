import { createClient } from "@/lib/api/hc-client"

// GET /rooms/:id。会議室マスタ 1 件の詳細。
export async function getRoomById(id: number) {
  const client = await createClient()

  const response = await client.rooms[":id"].$get({ param: { id: String(id) } })

  if (response.status >= 400) {
    return new Error("failed to load room")
  }

  return response.json()
}
