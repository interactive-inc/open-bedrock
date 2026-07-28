import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /commendations。表彰を記録する（commendation:manage）。 */
export async function createCommendation(request: {
  employee_id: number
  title: string
  reason: string
  awarded_on: string
}) {
  const client = await createClient()

  const response = await client.commendations.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "表彰の記録に失敗しました" })
  }

  return response.json()
}
