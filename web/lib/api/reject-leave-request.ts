import { createClient } from "@/lib/api/hc-client"

// POST /leave/requests/:id/reject。任意コメント付きで休暇申請を却下する。
export async function rejectLeaveRequest(id: number, comment: string | null) {
  const client = await createClient()

  const response = await client.leave.requests[":id"].reject.$post({
    param: { id: String(id) },
    json: { comment: comment },
  })

  if (response.status >= 400) {
    return new Error("failed to reject leave request")
  }

  return response.json()
}
