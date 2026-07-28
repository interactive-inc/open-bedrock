import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

export async function reviewGovernanceDocument(input: {
  code: string
  version: string
  orgRoleCode: string
  decision: "approved" | "rejected"
  comment: string | null
}) {
  const client = await createClient()
  const response = await client["governance-documents"][":code"].versions[":version"].review.$post({
    param: { code: input.code, version: input.version },
    json: {
      org_role_code: input.orgRoleCode,
      decision: input.decision,
      comment: input.comment,
    },
  })
  if (response.status >= 400) {
    return toApiResponseError(response, "レビュー判断の保存に失敗しました")
  }
  return response.json()
}
