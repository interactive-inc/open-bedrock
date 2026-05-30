import { createClient } from "@/lib/api/hc-client"

// POST /leave/requests/:id/approve。任意コメント付きで休暇申請を承認する。
export async function approveLeaveRequest(id: number, comment: string | null) {
  const client = await createClient()

  const response = await client.leave.requests[":id"].approve.$post({
    param: { id: String(id) },
    json: { comment: comment },
  })

  if (response.status >= 400) {
    return new Error("failed to approve leave request")
  }

  return response.json()
}
