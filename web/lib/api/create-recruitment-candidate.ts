import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// POST /recruitment/positions/:id/candidates。応募者を applied で登録する（recruitment:manage）。
export async function createRecruitmentCandidate(request: {
  positionId: number
  name: string
  email: string | null
  source: string | null
  note: string | null
}) {
  const client = await createClient()

  const response = await client.recruitment.positions[":id"].candidates.$post({
    param: { id: String(request.positionId) },
    json: {
      name: request.name,
      email: request.email,
      source: request.source,
      note: request.note,
    },
  })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "応募者の登録に失敗しました" })
  }

  return response.json()
}
