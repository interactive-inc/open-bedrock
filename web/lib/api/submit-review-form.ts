import { createClient } from "@/lib/api/hc-client"
import type { ReviewFormSubmitRequest } from "@/lib/api/types/review-types"

type Props = {
  formId: number
  request: ReviewFormSubmitRequest
}

// POST /review-forms/:form_id/submit。割り当てられた評価者がフォームを提出する。
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

  const response = await client["review-forms"][":form_id"].submit.$post({
    param: { form_id: String(props.formId) },
    json,
  })

  if (response.status >= 400) {
    return new Error("failed to submit review form")
  }

  return response.json()
}
