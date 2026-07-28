import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { AnnouncementCreateRequest } from "@/lib/api/types/announcement-types"

/** POST /announcements。社内アナウンスを下書きで新規作成する（announcement:manage）。 */
export async function createAnnouncement(request: AnnouncementCreateRequest) {
  const client = await createClient()

  const response = await client.announcements.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "アナウンスの作成に失敗しました" })
  }

  return response.json()
}
