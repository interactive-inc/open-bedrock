import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

export async function getGovernanceOrgRoles() {
  const client = await createClient()
  const response = await client.governance["org-roles"].$get()
  if (response.status >= 400) {
    return toApiResponseError(response, "組織ロールの取得に失敗しました")
  }
  return response.json()
}
