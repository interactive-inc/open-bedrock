import { createClient } from "@/lib/api/hc-client"
import type { PartnerSearchQuery } from "@/lib/api/types/partner-types"

// GET /partners。取引先一覧。キーワード / status で絞り込み可能。
export async function getPartnerList(query: PartnerSearchQuery) {
  const client = await createClient()

  const response = await client.partners.$get({
    query: { q: query.q ?? undefined, status: query.status ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load partners")
  }

  const body = await response.json()

  return body.data
}
