import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * POST /business-trips/:id/approve。出張申請を承認する。
 * 権限なしは 403、不存在は 404、遷移不可は 409 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function approveBusinessTrip(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["business-trip"]["business-trips"][":id"].approve.$post({
    param: { id },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "出張申請の承認に失敗しました",
      conflictMessages: {
        "business trip is not in a transitionable state": "この申請は承認できません",
      },
    })
  }

  return null
}
