import { createClient } from "@/lib/api/hc-client"

// GET /leave/requests/inbox。承認者向けの承認待ち休暇申請一覧。権限が無い場合は 403 で Error を返す。
export async function getLeaveInbox() {
  const client = await createClient()

  const response = await client.leave.requests.inbox.$get()

  if (response.status >= 400) {
    return new Error("failed to load leave inbox")
  }

  return response.json()
}
