import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

export async function getGovernanceImpact() {
  const client = await createClient()
  const response = await client.governance.impact.$get()
  if (response.status >= 400) {
    return toApiResponseError(response, "規程と組織の整合性検査に失敗しました")
  }
  return response.json()
}
