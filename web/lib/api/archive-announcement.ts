import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /announcements/:id/archive。アナウンスをアーカイブする（announcement:manage）。 */
export async function archiveAnnouncement(id: number) {
  const client = await createClient()

  const response = await client["announcement"]["announcements"][":id"].archive.$post({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "アナウンスのアーカイブに失敗しました" })
  }

  return response.json()
}
