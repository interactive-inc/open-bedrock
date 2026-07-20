import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * DELETE /training/enrollments/:id。受講を取り消す。
 * 本人以外は 403、完了済みは 409、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function cancelTrainingEnrollment(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.training.enrollments[":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "受講の取り消しに失敗しました",
      conflictMessages: {
        "enrollment is completed or failed and cannot be cancelled":
          "完了・不合格の受講は取り消しできません",
      },
    })
  }

  return null
}
