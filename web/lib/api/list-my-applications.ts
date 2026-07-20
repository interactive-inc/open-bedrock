import { createClient } from "@/lib/api/hc-client"

type Params = {
  limit?: number
  offset?: number
}

/** GET /applications/me。ログイン本人の申請一覧（payload を含む）。data と total を返す。 */
export async function listMyApplications(params: Params = {}) {
  const client = await createClient()

  const response = await client.applications.me.$get({
    query: {
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load my applications")
  }

  return response.json()
}
