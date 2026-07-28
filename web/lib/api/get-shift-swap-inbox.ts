import { createClient } from "@/lib/api/hc-client"
import type { ShiftSwapRequestInboxResponse } from "@/lib/api/types/shift-types"

export async function getShiftSwapInbox(): Promise<
  ReadonlyArray<ShiftSwapRequestInboxResponse> | Error
> {
  const client = await createClient()

  const response = await client["shift-swap-requests"].$get({ query: { limit: "100" } })

  if (response.status >= 400) {
    return new Error("failed to load shift swap inbox")
  }

  const body = await response.json()

  return body.data
}
