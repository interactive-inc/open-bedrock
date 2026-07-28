import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { RingiSubmitRequest } from "@/lib/api/types/ringi-types"

/** POST /ringi-requests。稟議を新規起案する。 */
export async function submitRingi(request: RingiSubmitRequest) {
  const client = await createClient()

  const response = await client["ringi-requests"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "稟議の起案に失敗しました" })
  }

  return response.json()
}
