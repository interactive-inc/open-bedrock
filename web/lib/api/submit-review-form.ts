import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ReviewFormSubmitRequest } from "@/lib/api/types/review-types"

type Props = {
  formId: number
  request: ReviewFormSubmitRequest
}

/** POST /review-forms/:formId/submit。割り当てられた評価者がフォームを提出する。 */
export async function submitReviewForm(props: Props) {
  const client = await createClient()

  const json: { score?: number; answers?: Array<unknown>; comment?: string } = {}

  if (props.request.score !== null) {
    json.score = props.request.score
  }

  json.answers = [...props.request.answers]

  if (props.request.comment !== null) {
    json.comment = props.request.comment
  }

  const response = await client["performance-review"]["review-forms"][":formId"].submit.$post({
    param: { formId: String(props.formId) },
    json,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "評価フォームの提出に失敗しました",
      conflictMessages: {
        "review cycle is not open": "評価サイクルが開始されていないため提出できません",
        "review form cannot be submitted": "この評価フォームは提出できません",
      },
    })
  }

  return response.json()
}
