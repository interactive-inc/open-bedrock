import { createClient } from "@/lib/api/hc-client"

/** GET /it-incidents を session トークン付きで呼び、インシデント記録一覧を取得する。 */
export async function getItIncidentList(query: {
  status?: "open" | "resolved"
  limit: number
  offset: number
}) {
  const client = await createClient()

  const response = await client["it-incident"]["it-incidents"].$get({
    query: {
      status: query.status,
      limit: String(query.limit),
      offset: String(query.offset),
    },
  })

  if (!response.ok) {
    return new Error("failed to load it incidents")
  }

  const body = await response.json()

  return { data: body.data, total: body.total }
}
