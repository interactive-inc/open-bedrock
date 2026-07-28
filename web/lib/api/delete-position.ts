import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** DELETE /position-definitions/:id。役職マスタを削除する。成功時（204）は null、失敗時は Error。 */
export async function deletePosition(positionId: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client["position-definitions"][":id"].$delete({
    param: { id: String(positionId) },
  })

  if (response.status !== 204) {
    return toResponseError(response, {
      fallback: "役職の削除に失敗しました",
    })
  }

  return null
}
