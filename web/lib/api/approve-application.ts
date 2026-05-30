import { createClient } from "@/lib/api/hc-client"

// POST /applications/:id/approve。任意コメント付きで申請を承認する。
export async function approveApplication(id: number, comment: string | null) {
  const client = await createClient()

  const response = await client.applications[":id"].approve.$post({
    param: { id: String(id) },
    json: { comment: comment },
  })

  if (response.status >= 400) {
    return new Error("failed to approve application")
  }

  return response.json()
}
