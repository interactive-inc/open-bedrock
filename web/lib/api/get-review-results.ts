import { createClient } from "@/lib/api/hc-client"
import type { ReviewResultResponse } from "@/lib/api/types/review-types"

type Props = {
  cycleId: number
  employeeCode: string
}

/** GET /review-cycles/:cycleId/results/:employeeCode。特権ロールが集計済みの評価結果を取得する。 */
export async function getReviewResults(props: Props): Promise<ReviewResultResponse | Error> {
  const client = await createClient()

  const response = await client["performance-review"]["review-cycles"][":cycleId"].results[
    ":employeeCode"
  ].$get({
    param: { cycleId: String(props.cycleId), employeeCode: props.employeeCode },
  })

  if (response.status >= 400) {
    return new Error("failed to load review results")
  }

  return response.json()
}
