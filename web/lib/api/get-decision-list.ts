import { createClient } from "@/lib/api/hc-client"

/** GET /decision-records を session トークン付きで呼び、意思決定記録一覧を取得する。 */
export async function getDecisionList(query: { limit: number; offset: number }) {
  const client = await createClient()

  const response = await client["decision-records"].$get({
    query: {
      limit: String(query.limit),
      offset: String(query.offset),
    },
  })

  if (!response.ok) {
    return new Error("failed to load decisions")
  }

  const body = await response.json()

  return { data: body.data, total: body.total }
}
