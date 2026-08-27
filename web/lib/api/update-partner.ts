import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { PartnerUpdateRequest } from "@/lib/api/types/partner-types"

/**
 * PUT /partners/:id。取引先の名称・分類・法人番号・備考を変更する（partner:manage）。
 * 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。
 */
export async function updatePartner(id: number, request: PartnerUpdateRequest) {
  const client = await createClient()

  const response = await client["partner"]["partners"][":id"].$put({
    param: { id: String(id) },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "取引先の変更に失敗しました",
    })
  }

  return response.json()
}
