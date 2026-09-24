import type { EntityId } from "@/lib/api/types/entity-id"
import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** DELETE /expense-budgets/:id。予算を削除する。budget:manage が無いと 403、不存在は 404。成功時は null。 */
export async function deleteBudget(id: EntityId): Promise<null | Error> {
  const client = await createClient()

  const response = await client["expense"]["expense-budgets"][":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "予算の削除に失敗しました" })
  }

  return null
}
