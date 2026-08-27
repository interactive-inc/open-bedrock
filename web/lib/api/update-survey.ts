import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { UpdateSurveyRequest } from "@/lib/api/types/survey-types"

/**
 * PUT /surveys/:surveyId。アンケートの内容を変更する（管理者ロールのみ）。
 * 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。
 */
export async function updateSurvey(id: number, request: UpdateSurveyRequest) {
  const client = await createClient()

  const response = await client["survey"]["surveys"][":surveyId"].$put({
    param: { surveyId: String(id) },
    json: {
      title: request.title,
      status: request.status,
      questions_json: [...request.questions_json],
    },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "アンケートの変更に失敗しました",
      conflictMessages: {
        "questions not modifiable when responses exist": "回答が存在するため設問は変更できません",
      },
    })
  }

  return response.json()
}
