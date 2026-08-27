import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /announcements/:id/publish。アナウンスを公開し全社へ通知する（announcement:manage）。 */
export async function publishAnnouncement(id: number) {
  const client = await createClient()

  const response = await client["announcement"]["announcements"][":id"].publish.$post({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "アナウンスの公開に失敗しました" })
  }

  return response.json()
}
