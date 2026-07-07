import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export type ItIncidentCreateRequest = {
  occurred_at: string
  title: string
  summary: string
  severity?: "low" | "medium" | "high" | "critical" | null
}

// POST /it-incidents。インシデント記録を新規登録する。失敗時は Error。
export async function createItIncident(request: ItIncidentCreateRequest) {
  const client = await createClient()

  const response = await client["it-incidents"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "インシデントの記録に失敗しました" })
  }

  return response.json()
}
