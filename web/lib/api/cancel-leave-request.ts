import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * DELETE /leave-requests/:id。休暇申請を取り下げる。
 * 本人以外は 403、決定済みは 409、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function cancelLeaveRequest(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client["leave"]["leave-requests"][":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "休暇申請の取り下げに失敗しました",
      conflictMessages: {
        "the leave request is already decided": "決定済みの休暇申請は取り下げできません",
      },
    })
  }

  return null
}
