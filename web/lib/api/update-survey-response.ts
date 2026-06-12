import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
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
    return toResponseError(response, {
      fallback: "アンケート回答の変更に失敗しました",
      conflictMessages: {
        "the survey is no longer open": "このアンケートは公開を終了しています",
      },
    })
  }

  return response.json()
}
