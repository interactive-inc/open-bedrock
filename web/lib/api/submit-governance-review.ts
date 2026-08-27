import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

export async function submitGovernanceReview(code: string, version: string) {
  const client = await createClient()
  const response = await client["governance"]["governance-documents"][":code"].versions[":version"][
    "submit-review"
  ].$post({
    param: { code, version },
  })
  if (response.status >= 400) {
    return toApiResponseError(response, "レビューへの提出に失敗しました")
  }
  return response.json()
}
