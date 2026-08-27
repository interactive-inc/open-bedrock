import { createClient } from "@/lib/api/hc-client"
import { ApiResponseError } from "@/lib/api/api-response-error"

/** GET /meetings/:code/minutes を session トークン付きで呼び、議事録一覧を取得する。 */
export async function getMeetingMinutesList(code: string) {
  const client = await createClient()

  const response = await client["meeting"]["meetings"][":code"].minutes.$get({
    param: { code: code },
  })

  if (response.status >= 400) {
    return new ApiResponseError(response.status, "failed to load meeting minutes")
  }

  const body = await response.json()

  return { data: body.data, total: body.total }
}
