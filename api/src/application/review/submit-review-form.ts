import { canSubmitForm } from "@/application/review/can-submit-form"
import type { ReviewForm } from "@/domain/review/review-form.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
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

/**
 * 割り当てられた評価者が、open のサイクルに属する自分のフォームを提出する。
 */
export class SubmitReviewForm {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ReviewForm | ApplicationError> {
    const formRepository = new ReviewFormRepository(this.c)

    const form = await formRepository.findById(input.formId)

    if (form instanceof Error) {
      return new UnexpectedError("failed to find review form", { cause: form })
    }

    if (form === null) {
      return new NotFoundError("review form not found", "form_not_found")
    }

    const isReviewer = canSubmitForm({
      reviewerEmployeeId: form.reviewerEmployeeId,
      viewerEmployeeId: input.viewerEmployeeId,
    })

    if (isReviewer === false) {
      return new ForbiddenError("cannot submit this review form", "forbidden")
    }

    if (form.status === "submitted") {
      return new ConflictError("review form is already submitted", "already_submitted")
    }

    const cycle = await new ReviewCycleRepository(this.c).findById(form.cycleId)

    if (cycle instanceof Error) {
      return new UnexpectedError("failed to find review cycle", { cause: cycle })
    }

    if (cycle === null || cycle.status !== "open") {
      return new ConflictError("review cycle is not open", "cycle_not_open")
    }

    const submitted = await formRepository.update(
      form.withSubmission(input.score, input.answers, input.comment, input.submittedAt),
    )

    if (submitted instanceof Error) {
      return new UnexpectedError("failed to update review form", { cause: submitted })
    }

    if (submitted === null) {
      return new ConflictError("review form is already submitted", "already_submitted")
    }

    if ("reason" in submitted) {
      return new ConflictError("review cycle is not open", "cycle_not_open")
    }

    return submitted
  }
}
