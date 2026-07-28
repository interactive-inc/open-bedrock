import { createClient } from "@/lib/api/hc-client"

/** GET /software-licenses を session トークン付きで呼び、ライセンス・SaaS 台帳一覧を取得する。 */
export async function getLicenseList(query: {
  status?: "active" | "cancelled"
  limit: number
  offset: number
}) {
  const client = await createClient()

  const response = await client["software-licenses"].$get({
    query: {
      status: query.status,
      limit: String(query.limit),
      offset: String(query.offset),
    },
  })

  if (!response.ok) {
    return new Error("failed to load licenses")
  }

  const body = await response.json()

  return { data: body.data, total: body.total }
}
