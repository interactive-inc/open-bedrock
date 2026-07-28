import { createClient } from "@/lib/api/hc-client"
import { ApiResponseError } from "@/lib/api/api-response-error"

/** GET /meetings/:code を session トークン付きで呼び、会議体詳細を取得する。 */
export async function getMeetingDetail(code: string) {
  const client = await createClient()

  const response = await client.meetings[":code"].$get({
    param: { code: code },
  })

  if (response.status >= 400) {
    return new ApiResponseError(response.status, "failed to load meeting detail")
  }

  return response.json()
}
