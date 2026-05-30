import { createClient } from "@/lib/api/hc-client"
import type { SubmitSurveyResponseRequest } from "@/lib/api/types/survey-types"

// アンケート回答を送信する。POST /surveys/:survey_id/responses。
export async function submitSurveyResponse(surveyId: number, body: SubmitSurveyResponseRequest) {
  const client = await createClient()

  const response = await client.surveys[":survey_id"].responses.$post({
    param: { survey_id: String(surveyId) },
    json: body,
  })

  if (response.status >= 400) {
    return new Error("failed to submit survey response")
  }

  return response.json()
}
