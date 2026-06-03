import { createClient } from "@/lib/api/hc-client"

// DELETE /leave/requests/:id。休暇申請を取り下げる。
// 本人以外は 403、決定済みは 409、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function cancelLeaveRequest(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.leave.requests[":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to cancel leave request")
  }

  return null
}
