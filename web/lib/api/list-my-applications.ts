import { createClient } from "@/lib/api/hc-client"

// GET /applications/me。ログイン本人の申請一覧（payload を含む）。
export async function listMyApplications() {
  const client = await createClient()

  const response = await client.applications.me.$get()

  if (response.status >= 400) {
    return new Error("failed to load my applications")
  }

  return response.json()
}
