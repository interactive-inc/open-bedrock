import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export type MeetingMinutesCreateRequest = {
  held_on: string
  title: string
  attendees?: string | null
  body_md: string
}

/** POST /meetings/:code/minutes。議事録を記録する。失敗時は Error。 */
export async function createMeetingMinutes(code: string, request: MeetingMinutesCreateRequest) {
  const client = await createClient()

  const response = await client["meeting"]["meetings"][":code"].minutes.$post({
    param: { code: code },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "議事録の記録に失敗しました",
    })
  }

  return response.json()
}
