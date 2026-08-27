import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /job-openings。募集ポジションを登録する（recruitment:manage）。 */
export async function createRecruitmentPosition(request: {
  title: string
  department_code: string | null
  note: string | null
}) {
  const client = await createClient()

  const response = await client["recruitment"]["job-openings"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "募集の登録に失敗しました" })
  }

  return response.json()
}
