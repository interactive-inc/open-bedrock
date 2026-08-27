import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** DELETE /resignations/:id。退職申請を取消する。本人以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。 */
export async function cancelResignation(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["resignation"]["resignations"][":id"].$delete({
    param: { id },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "退職申請の取消に失敗しました",
      conflictMessages: {
        "not modifiable": "この退職申請は取消できません",
      },
    })
  }

  return null
}
