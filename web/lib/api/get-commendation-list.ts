import { createClient } from "@/lib/api/hc-client"

// GET /commendations。表彰の記録一覧（社内公開。全認証者が閲覧可）。
export async function getCommendationList(query: { limit: number; offset: number }) {
  const client = await createClient()

  const response = await client.commendations.$get({
    query: { limit: String(query.limit), offset: String(query.offset) },
  })

  if (response.status >= 400) {
    return new Error("failed to load commendations")
  }

  const body = await response.json()

  return { data: body.data, total: body.total }
}
