import { createClient } from "@/lib/api/hc-client"
import type { RegulationStatus } from "@/lib/api/types/regulation-types"

// GET /regulations。規程集一覧。status で絞り込み可能。
export async function getRegulationList(query: { status: RegulationStatus | null }) {
  const client = await createClient()

  const response = await client.regulations.$get({
    query: { status: query.status ?? undefined },
  })

  if (!response.ok) {
    return new Error("failed to load regulations")
  }

  const body = await response.json()

  return body.data
}
