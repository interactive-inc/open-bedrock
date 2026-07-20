import { createClient } from "@/lib/api/hc-client"
import type { ReviewResultResponse } from "@/lib/api/types/review-types"

type Props = {
  cycleId: number
  employeeCode: string
}

/** GET /review-cycles/:cycle_id/results/:employee_code。特権ロールが集計済みの評価結果を取得する。 */
export async function getReviewResults(props: Props): Promise<ReviewResultResponse | Error> {
  const client = await createClient()

  const response = await client["review-cycles"][":cycle_id"].results[":employee_code"].$get({
    param: { cycle_id: String(props.cycleId), employee_code: props.employeeCode },
  })

  if (response.status >= 400) {
    return new Error("failed to load review results")
  }

  return response.json()
}
