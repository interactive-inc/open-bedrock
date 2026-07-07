import { createClient } from "@/lib/api/hc-client"

// GET /recruitment/positions。募集ポジション一覧（recruitment:manage）。
export async function getRecruitmentPositionList(query: { status?: "open" | "closed" }) {
  const client = await createClient()

  const response = await client.recruitment.positions.$get({
    query: { status: query.status ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load recruitment positions")
  }

  const body = await response.json()

  return body.data
}
