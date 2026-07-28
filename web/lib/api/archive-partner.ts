import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * POST /partners/:id/archive。取引先をアーカイブする（partner:manage）。
 * 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function archivePartner(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.partners[":id"].archive.$post({ param: { id: String(id) } })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "取引先のアーカイブに失敗しました",
    })
  }

  return null
}
