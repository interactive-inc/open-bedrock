import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

export async function revokeGovernanceOrgRole(assignmentId: number): Promise<null | Error> {
  const client = await createClient()
  const response = await client.governance["org-roles"].assignments[":id"].$delete({
    param: { id: String(assignmentId) },
  })
  if (response.status >= 400) {
    return toApiResponseError(response, "組織ロールの割当解除に失敗しました")
  }
  return null
}
