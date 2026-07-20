import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * POST /resignations/:id/accept。退職申請を受理する。
 * 権限なしは 403、不存在は 404、遷移不可は 409 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function acceptResignation(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client.resignations[":id"].accept.$post({
    param: { id },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "退職申請の受理に失敗しました",
      conflictMessages: {
        "resignation is not in a transitionable state": "この申請は受理できません",
      },
    })
  }

  return null
}
