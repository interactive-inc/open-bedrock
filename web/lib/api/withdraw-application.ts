import { createClient } from "@/lib/api/hc-client"

// DELETE /applications/:id。申請を取り下げる。
// 本人以外は 403、審査済みは 409 を api が返すため、戻りは Error になる。成功時は null。
export async function withdrawApplication(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.applications[":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to withdraw application")
  }

  return null
}
