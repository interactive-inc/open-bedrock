import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * POST /family-care-leaves/:id/cancel。産休・育休・介護休業の申出を取消にする。
 * 権限なしは 403、不存在は 404、遷移不可は 409 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function cancelFamilyCareLeaveApproval(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["family-care-leaves"][":id"].cancel.$post({
    param: { id },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "休業申出の取消に失敗しました",
      conflictMessages: {
        "family care leave is not in a transitionable state": "この申出は取消できません",
      },
    })
  }

  return null
}
