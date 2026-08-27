import { createClient } from "@/lib/api/hc-client"

/** GET /meetings を session トークン付きで呼び、会議体一覧を取得する。 */
export async function getMeetingList(query: { limit: number; offset: number }) {
  const client = await createClient()

  const response = await client["meeting"]["meetings"].$get({
    query: {
      limit: String(query.limit),
      offset: String(query.offset),
    },
  })

  if (!response.ok) {
    return new Error("failed to load meetings")
  }

  const body = await response.json()

  return { data: body.data, total: body.total }
}
