import { createClient } from "@/lib/api/hc-client"
import type { ApplicationSubmitRequest } from "@/lib/api/types/application-types"

// POST /applications。テンプレコードと payload で申請を提出し、作成された詳細を返す。
export async function submitApplication(body: ApplicationSubmitRequest) {
  const client = await createClient()

  const response = await client.applications.$post({ json: body })

  if (response.status >= 400) {
    return new Error("failed to submit application")
  }

  return response.json()
}
