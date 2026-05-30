import { createClient } from "@/lib/api/hc-client"

// GET /applications。ログイン本人が提出した申請一覧。status で絞り込み可。
export async function getMyApplications(status: string | null) {
  const client = await createClient()

  const response = await client.applications.$get({
    query: { status: status ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load my applications")
  }

  return response.json()
}
