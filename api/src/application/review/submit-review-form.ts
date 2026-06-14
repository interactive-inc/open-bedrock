import { canSubmitForm } from "@/lib/review/can-submit-form"
import type { ReviewForm } from "@/domain/review/review-form.entity"
import type { Context } from "@/env"
import { ReviewCycleRepository } from "@/infrastructure/review/review-cycle-repository"
import { ReviewFormRepository } from "@/infrastructure/review/review-form-repository"

export type Input = {
  viewerEmployeeId: number
  formId: number
  score: number | null
  answers: ReadonlyArray<unknown>
  comment: string | null
  submittedAt: string
}

export type FormNotFound = { reason: "form_not_found" }

export type Forbidden = { reason: "forbidden" }

export type AlreadySubmitted = { reason: "already_submitted" }

export type CycleNotOpen = { reason: "cycle_not_open" }

export type SubmitReviewFormFailure = FormNotFound | Forbidden | AlreadySubmitted | CycleNotOpen

/**
 * 割り当てられた評価者が、open のサイクルに属する自分のフォームを提出する。
 */
export class SubmitReviewForm {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ReviewForm | SubmitReviewFormFailure | Error> {
    const formRepository = new ReviewFormRepository(this.c)

    const form = await formRepository.findById(input.formId)

    if (form instanceof Error) {
      return form
    }

    if (form === null) {
      return { reason: "form_not_found" }
    }

    const isReviewer = canSubmitForm({
      reviewerEmployeeId: form.reviewerEmployeeId,
      viewerEmployeeId: input.viewerEmployeeId,
    })

    if (isReviewer === false) {
      return { reason: "forbidden" }
    }

    if (form.status === "submitted") {
      return { reason: "already_submitted" }
    }

    const cycle = await new ReviewCycleRepository(this.c).findById(form.cycleId)

    if (cycle instanceof Error) {
      return cycle
    }

    if (cycle === null || cycle.status !== "open") {
      return { reason: "cycle_not_open" }
    }

    const submitted = await formRepository.update(
      form.withSubmission(input.score, input.answers, input.comment, input.submittedAt),
    )

    if (submitted instanceof Error) {
      return submitted
    }

    if (submitted === null) {
      return { reason: "already_submitted" as const }
    }

    if ("reason" in submitted) {
      return { reason: "cycle_not_open" as const }
    }

    return submitted
  }
}
