import { createClient } from "@/lib/api/hc-client"

// DELETE /surveys/responses/:id。自分のアンケート回答を取り下げる。
// 本人以外は 403、不存在は 404、公開を終えたアンケートは 409 を api が返す。成功時は null。
export async function withdrawSurveyResponse(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.surveys.responses[":response_id"].$delete({
    param: { response_id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to withdraw survey response")
  }

  return null
}
