import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// DELETE /surveys/responses/:id。自分のアンケート回答を取り下げる。
// 本人以外は 403、不存在は 404、公開を終えたアンケートは 409 を api が返す。成功時は null。
export async function withdrawSurveyResponse(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.surveys.responses[":response_id"].$delete({
    param: { response_id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "アンケート回答の取り下げに失敗しました",
      conflictMessages: {
        "the survey is no longer open": "このアンケートは公開を終了しています",
      },
    })
  }

  return null
}
