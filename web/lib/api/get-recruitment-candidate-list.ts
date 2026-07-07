import { createClient } from "@/lib/api/hc-client"

// GET /recruitment/positions/:id/candidates。募集配下の応募者一覧（recruitment:manage）。
export async function getRecruitmentCandidateList(positionId: number) {
  const client = await createClient()

  const response = await client.recruitment.positions[":id"].candidates.$get({
    param: { id: String(positionId) },
  })

  if (response.status >= 400) {
    return new Error("failed to load recruitment candidates")
  }

  const body = await response.json()

  return body.data
}
