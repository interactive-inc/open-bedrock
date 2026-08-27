import { createClient } from "@/lib/api/hc-client"

/** 指定アンケートの集計を取得する。GET /surveys/:surveyId/summary。 */
export async function getSurveySummary(surveyId: number) {
  const client = await createClient()

  const response = await client["survey"]["surveys"][":surveyId"].summary.$get({
    param: { surveyId: String(surveyId) },
  })

  if (response.status >= 400) {
    return new Error("failed to load survey summary")
  }

  return response.json()
}
