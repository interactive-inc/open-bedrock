import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

export async function publishGovernanceDocument(code: string, version: string) {
  const client = await createClient()
  const response = await client.governance.documents[":code"].versions[":version"].publish.$post({
    param: { code, version },
  })
  if (response.status >= 400) {
    return toApiResponseError(response, "規程・手続きの公開に失敗しました")
  }
  return response.json()
}
