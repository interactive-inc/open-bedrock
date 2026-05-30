import { createClient } from "@/lib/api/hc-client"
import type { CareerApplyRequest } from "@/lib/api/types/career-types"

// 指定の社内公募へ応募する。POST /career/postings/:posting_id/apply。
export async function applyCareerPosting(postingId: number, body: CareerApplyRequest) {
  const client = await createClient()

  const response = await client.career.postings[":posting_id"].apply.$post({
    param: { posting_id: String(postingId) },
    json: body,
  })

  if (response.status >= 400) {
    return new Error("failed to apply career posting")
  }

  return response.json()
}
