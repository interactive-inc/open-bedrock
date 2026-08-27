import { createClient } from "@/lib/api/hc-client"
import type { AnnouncementStatus } from "@/lib/api/types/announcement-types"

/** GET /announcements。社内アナウンス一覧。管理者は status で下書き等も絞り込める。 */
export async function getAnnouncementList(query: { status: AnnouncementStatus | null }) {
  const client = await createClient()

  const response = await client["announcement"]["announcements"].$get({
    query: { status: query.status ?? undefined },
  })

  if (!response.ok) {
    return new Error("failed to load announcements")
  }

  const body = await response.json()

  return body.data
}
