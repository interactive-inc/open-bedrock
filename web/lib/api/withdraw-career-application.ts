import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * DELETE /career/applications/:id。公募応募を取り下げる。
 * 本人以外は 403、選考確定済みは 409、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function withdrawCareerApplication(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.career.applications[":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "公募応募の取り下げに失敗しました",
      conflictMessages: {
        "the application is already decided": "選考確定済みの応募は取り下げできません",
      },
    })
  }

  return null
}
