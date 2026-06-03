import { createClient } from "@/lib/api/hc-client"

// DELETE /training/enrollments/:id。受講を取り消す。
// 本人以外は 403、完了済みは 409、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function cancelTrainingEnrollment(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.training.enrollments[":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to cancel training enrollment")
  }

  return null
}
