import { createClient } from "@/lib/api/hc-client"

// 指定アンケートを取得する。GET /surveys/:survey_id。
export async function getSurvey(surveyId: number) {
  const client = await createClient()

  const response = await client.surveys[":survey_id"].$get({
    param: { survey_id: String(surveyId) },
  })

  const status = response.status as number

  if (status === 404) {
    return null
  }

  if (status >= 400) {
    return new Error("failed to load survey")
  }

  return response.json()
}
