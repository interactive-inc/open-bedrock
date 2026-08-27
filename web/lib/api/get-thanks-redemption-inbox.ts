import { createClient } from "@/lib/api/hc-client"
import type { ThanksRedemptionInboxResponse } from "@/lib/api/types/thanks-points-types"

export async function getThanksRedemptionInbox(): Promise<
  ReadonlyArray<ThanksRedemptionInboxResponse> | Error
> {
  const client = await createClient()

  const response = await client["thanks"]["thanks-redemptions"].inbox.$get({
    query: { limit: "100" },
  })

  if (response.status >= 400) {
    return new Error("failed to load redemption inbox")
  }

  const body = await response.json()

  return body.data
}
