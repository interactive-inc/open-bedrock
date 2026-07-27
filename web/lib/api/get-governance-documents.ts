import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

export async function getGovernanceDocuments(query?: { q?: string; kind?: string }) {
  const client = await createClient()
  const response = await client["governance-documents"].$get({
    query: { q: query?.q, kind: query?.kind },
  })
  if (response.status >= 400) {
    return toApiResponseError(response, "規程・手続きの取得に失敗しました")
  }
  return response.json()
}
