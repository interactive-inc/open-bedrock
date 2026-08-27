import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { CreateSurveyRequest } from "@/lib/api/types/survey-types"

/**
 * POST /surveys。アンケートを新規作成する（管理者ロールのみ）。
 * 権限不足は 403 を api が返すため、戻りは Error になる。
 */
export async function createSurvey(request: CreateSurveyRequest) {
  const client = await createClient()

  const response = await client["survey"]["surveys"].$post({
    json: {
      title: request.title,
      status: request.status,
      questions_json: [...request.questions_json],
    },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "アンケートの作成に失敗しました",
    })
  }

  return response.json()
}
