import { createClient } from "@/lib/api/hc-client"

/**
 * GET /review-cycles/periods。評価期間ラベルの一覧を取得する。
 *
 * `getReviewCycles` は `review:administer` が無いと open のサイクルしか返さないため、
 * 期間の選択肢にはこちらを使う。まだ open していない今期の期間も含めて返る。
 */
export async function getReviewPeriods(): Promise<string[] | Error> {
  const client = await createClient()

  const response = await client["performance-review"]["review-cycles"].periods.$get()

  if (response.status >= 400) {
    return new Error("failed to load review periods")
  }

  const body = await response.json()

  return body.data
}
