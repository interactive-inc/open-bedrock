import { createClient } from "@/lib/api/hc-client"

/** GET /job-openings/:jobOpeningId/candidates。募集配下の応募者一覧（recruitment:manage）。 */
export async function getRecruitmentCandidateList(positionId: number) {
  const client = await createClient()

  const response = await client["job-openings"][":jobOpeningId"].candidates.$get({
    param: { jobOpeningId: String(positionId) },
  })

  if (response.status >= 400) {
    return new Error("failed to load recruitment candidates")
  }

  const body = await response.json()

  return body.data
}
