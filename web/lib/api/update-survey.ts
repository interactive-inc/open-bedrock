import { createClient } from "@/lib/api/hc-client"
import type { UpdateSurveyRequest } from "@/lib/api/types/survey-types"

// PUT /surveys/:survey_id。アンケートの内容を変更する（管理者ロールのみ）。
// 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。
export async function updateSurvey(id: number, request: UpdateSurveyRequest) {
  const client = await createClient()

  const response = await client.surveys[":survey_id"].$put({
    param: { survey_id: String(id) },
    json: {
      title: request.title,
      status: request.status,
      questions_json: [...request.questions_json],
    },
  })

  if (response.status >= 400) {
    return new Error("failed to update survey")
  }

  return response.json()
}
