import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export type MeetingCreateRequest = {
  code: string
  name: string
  cadence?: string | null
  description?: string | null
}

/** POST /meetings。会議体を作成する。失敗時は Error。 */
export async function createMeeting(request: MeetingCreateRequest) {
  const client = await createClient()

  const response = await client["meeting"]["meetings"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "会議体の登録に失敗しました",
      conflictMessages: { "meeting code already exists": "同じコードの会議体が既に存在します" },
    })
  }

  return response.json()
}
