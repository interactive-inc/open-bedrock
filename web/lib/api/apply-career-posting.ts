import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { CareerApplyRequest } from "@/lib/api/types/career-types"

/** 指定の社内公募へ応募する。POST /career-postings/:postingId/apply。 */
export async function applyCareerPosting(postingId: number, body: CareerApplyRequest) {
  const client = await createClient()

  const response = await client["career"]["career-postings"][":postingId"].apply.$post({
    param: { postingId: String(postingId) },
    json: body,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "社内公募への応募に失敗しました",
      conflictMessages: {
        "already applied": "この公募には既に応募済みです",
      },
    })
  }

  return response.json()
}
