import { canSubmitForm } from "@/contexts/performance-review/domain/policies/review-form-submission.policy"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { ReviewForm } from "@/contexts/performance-review/domain/entities/review-form.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review/review-cycle.repository"
import type { ReviewFormRepository } from "@/contexts/performance-review/infrastructure/repositories/review/review-form.repository"

type Context = Readonly<{
  reviewFormRepository: Pick<ReviewFormRepository, "findById" | "update">
  reviewCycleRepository: Pick<ReviewCycleRepository, "findById">
}>

export type Input = {
  viewerEmployeeId: EmployeeId
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
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(input: Input): Promise<ReviewForm | ApplicationError> {
    const form = await this.c.reviewFormRepository.findById(input.formId)

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

    const cycle = await this.c.reviewCycleRepository.findById(form.cycleId)

    if (cycle instanceof Error) {
      return new UnexpectedError("failed to find review cycle", { cause: cycle })
    }

    if (cycle === null || cycle.status !== "open") {
      return new ConflictError("review cycle is not open", "cycle_not_open")
    }

    const submitted = await this.c.reviewFormRepository.update(
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
