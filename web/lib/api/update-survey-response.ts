import { createClient } from "@/lib/api/hc-client"
import type { SurveyResponseItem, UpdateSurveyResponseRequest } from "@/lib/api/types/survey-types"

// PUT /surveys/responses/:id。自分のアンケート回答を差し替える。
// 本人以外は 403、公開を終えたアンケートは 409 を api が返すため、戻りは Error になる。
export async function updateSurveyResponse(
  id: number,
  request: UpdateSurveyResponseRequest,
): Promise<SurveyResponseItem | Error> {
  const client = await createClient()

  const response = await client.surveys.responses[":response_id"].$put({
    param: { response_id: String(id) },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to update survey response")
  }

  return response.json()
}
