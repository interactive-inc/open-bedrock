import { createClient } from "@/lib/api/hc-client"
import type { SurveyResponseItem } from "@/lib/api/types/survey-types"

/** GET /surveys/responses/me。回答者本人のアンケート回答一覧を取得する。 */
export async function listMySurveyResponses(): Promise<ReadonlyArray<SurveyResponseItem> | Error> {
  const client = await createClient()

  const response = await client["survey"]["surveys"].responses.me.$get()

  if (response.status >= 400) {
    return new Error("failed to load survey responses")
  }

  const body = await response.json()

  return body.data
}
