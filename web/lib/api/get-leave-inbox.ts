import { createClient } from "@/lib/api/hc-client"

type Params = {
  limit?: number
  offset?: number
}

// GET /leave/requests/inbox。承認者向けの承認待ち休暇申請一覧。data と total を併せて返す。
// 権限が無い場合は 403 で Error を返す。
export async function getLeaveInbox(params: Params = {}) {
  const client = await createClient()

  const response = await client.leave.requests.inbox.$get({
    query: {
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load leave inbox")
  }

  return response.json()
}
