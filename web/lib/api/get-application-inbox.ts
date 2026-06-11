import { createClient } from "@/lib/api/hc-client"

// GET /applications/inbox。承認者向けの承認待ち申請一覧。
export async function getApplicationInbox() {
  const client = await createClient()

  const response = await client.applications.inbox.$get()

  if (response.status >= 400) {
    return new Error("failed to load application inbox")
  }

  const body = await response.json()

  return body.data
}
