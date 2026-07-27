import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

export async function acknowledgeGovernanceDocument(code: string) {
  const client = await createClient()
  const response = await client["governance-documents"][":code"].acknowledge.$post({
    param: { code },
  })
  if (response.status >= 400) {
    return toApiResponseError(response, "確認記録の保存に失敗しました")
  }
  return response.json()
}
