import { createClient } from "@/lib/api/hc-client"
import type { LifeEventCreateRequest } from "@/lib/api/types/life-event-types"

// POST /life-events。ライフイベント届出を作成する。status は submitted で登録される。
export async function createLifeEvent(request: LifeEventCreateRequest) {
  const client = await createClient()

  const response = await client["life-events"].$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to create life event")
  }

  return response.json()
}
