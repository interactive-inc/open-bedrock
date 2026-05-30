import { createClient } from "@/lib/api/hc-client"

// 指定アンケートの集計を取得する。GET /surveys/:survey_id/summary。
export async function getSurveySummary(surveyId: number) {
  const client = await createClient()

  const response = await client.surveys[":survey_id"].summary.$get({
    param: { survey_id: String(surveyId) },
  })

  if (response.status >= 400) {
    return new Error("failed to load survey summary")
  }

  return response.json()
}
