import { createClient } from "@/lib/api/hc-client"

/** GET /announcements/:id。アナウンス1件の詳細。 */
export async function getAnnouncementDetail(id: number) {
  const client = await createClient()

  const response = await client["announcement"]["announcements"][":id"].$get({
    param: { id: String(id) },
  })

  if (!response.ok) {
    return new Error("failed to load announcement")
  }

  return response.json()
}
