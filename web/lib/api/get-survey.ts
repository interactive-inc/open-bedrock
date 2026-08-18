import { createClient } from "@/lib/api/hc-client"
import { ApiResponseError } from "@/lib/api/api-response-error"

/** 指定アンケートを取得する。GET /surveys/:surveyId。 */
export async function getSurvey(surveyId: number) {
  const client = await createClient()

  const response = await client.surveys[":surveyId"].$get({
    param: { surveyId: String(surveyId) },
  })

  const status: number = response.status

  if (status === 404) {
    return null
  }

  if (status >= 400) {
    return new ApiResponseError(status, "failed to load survey")
  }

  return response.json()
}
