import { createClient } from "@/lib/api/hc-client"

// POST /applications/:id/reject。コメント必須で申請を却下する。
export async function rejectApplication(id: number, comment: string) {
  const client = await createClient()

  const response = await client.applications[":id"].reject.$post({
    param: { id: String(id) },
    json: { comment: comment },
  })

  if (response.status >= 400) {
    return new Error("failed to reject application")
  }

  return response.json()
}
