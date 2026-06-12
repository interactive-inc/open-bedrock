import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { LifeEventCreateRequest } from "@/lib/api/types/life-event-types"

// POST /life-events。ライフイベント届出を作成する。status は submitted で登録される。
export async function createLifeEvent(request: LifeEventCreateRequest) {
  const client = await createClient()

  const response = await client["life-events"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "ライフイベント届出の作成に失敗しました" })
  }

  return response.json()
}
