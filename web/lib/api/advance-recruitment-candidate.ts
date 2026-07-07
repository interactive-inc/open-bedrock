import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export type CandidateStage = "applied" | "screening" | "interview" | "offer" | "hired" | "rejected"

// POST /recruitment/candidates/:id/advance。選考ステージを前進・不採用へ（recruitment:manage）。不正遷移は 409。
export async function advanceRecruitmentCandidate(request: {
  candidateId: number
  stage: CandidateStage
}) {
  const client = await createClient()

  const response = await client.recruitment.candidates[":id"].advance.$post({
    param: { id: String(request.candidateId) },
    json: { stage: request.stage },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "選考ステージの更新に失敗しました",
      conflictMessages: {},
    })
  }

  return response.json()
}
