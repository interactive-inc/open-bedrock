import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** DELETE /commendations/:id。表彰の記録を削除する（commendation:manage）。 */
export async function deleteCommendation(id: number) {
  const client = await createClient()

  const response = await client["commendation"]["commendations"][":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "表彰の削除に失敗しました" })
  }

  return true
}
