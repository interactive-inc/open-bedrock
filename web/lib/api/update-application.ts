import { createClient } from "@/lib/api/hc-client"

// PUT /applications/:id。申請内容（payload）を更新する。
// 本人以外は 403、審査済みは 409 を api が返すため、戻りは Error になる。
export async function updateApplication(id: number, payload: unknown) {
  const client = await createClient()

  const response = await client.applications[":id"].$put({
    param: { id: String(id) },
    json: { payload: payload },
  })

  if (response.status >= 400) {
    return new Error("failed to update application")
  }

  return response.json()
}
