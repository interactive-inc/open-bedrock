import { createClient } from "@/lib/api/hc-client"
import type { LifeEventResponse } from "@/lib/api/types/life-event-types"

// GET /life-events/me。届出者本人のライフイベント届出一覧を取得する。
export async function listMyLifeEvents(): Promise<ReadonlyArray<LifeEventResponse> | Error> {
  const client = await createClient()

  const response = await client["life-events"].me.$get()

  if (response.status >= 400) {
    return new Error("failed to load life events")
  }

  return response.json()
}
