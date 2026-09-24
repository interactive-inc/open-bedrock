import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { RingiSubmitRequest } from "@/lib/api/types/ringi-types"

/** POST /ringi-requests。稟議を新規起案する。 */
export async function submitRingi(request: RingiSubmitRequest) {
  const client = await createClient()

  const response = await client["ringi"]["ringi-requests"].$post({
    json: {
      ...request,
      existing_ringi_id:
        request.existing_ringi_id == null
          ? request.existing_ringi_id
          : Number(request.existing_ringi_id),
      previous_ringi_id:
        request.previous_ringi_id == null
          ? request.previous_ringi_id
          : Number(request.previous_ringi_id),
    },
  })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "稟議の起案に失敗しました" })
  }

  return response.json()
}
