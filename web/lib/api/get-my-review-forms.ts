import { createClient } from "@/lib/api/hc-client"
import type { ReviewFormResponse } from "@/lib/api/types/review-types"

/** GET /review-forms/me。本人が評価者として割り当てられたフォームの一覧を取得する。 */
export async function getMyReviewForms(): Promise<Array<ReviewFormResponse> | Error> {
  const client = await createClient()

  const response = await client["review-forms"].me.$get()

  if (response.status >= 400) {
    return new Error("failed to load my review forms")
  }

  const body = await response.json()

  return body.data
}
