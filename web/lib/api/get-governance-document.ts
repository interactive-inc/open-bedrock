import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

export async function getGovernanceDocument(code: string) {
  const client = await createClient()
  const response = await client.governance.documents[":code"].$get({ param: { code } })
  if (response.status >= 400) {
    return toApiResponseError(response, "規程・手続きの取得に失敗しました")
  }
  return response.json()
}
