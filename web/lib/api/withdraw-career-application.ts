import { createClient } from "@/lib/api/hc-client"

// DELETE /career/applications/:id。公募応募を取り下げる。
// 本人以外は 403、選考確定済みは 409、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function withdrawCareerApplication(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.career.applications[":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to withdraw career application")
  }

  return null
}
