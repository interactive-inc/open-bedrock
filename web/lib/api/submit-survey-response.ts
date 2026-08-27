import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { SubmitSurveyResponseRequest } from "@/lib/api/types/survey-types"

/** アンケート回答を送信する。POST /surveys/:surveyId/responses。 */
export async function submitSurveyResponse(surveyId: number, body: SubmitSurveyResponseRequest) {
  const client = await createClient()

  const response = await client["survey"]["surveys"][":surveyId"].responses.$post({
    param: { surveyId: String(surveyId) },
    json: body,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "アンケート回答の送信に失敗しました",
      conflictMessages: {
        "already submitted": "このアンケートには既に回答済みです",
        "the survey is no longer open": "このアンケートは公開を終了しています",
      },
    })
  }

  return response.json()
}
