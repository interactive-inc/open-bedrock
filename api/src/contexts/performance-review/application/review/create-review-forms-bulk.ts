import type { Session } from "@/contexts/company/domain/iam/session"
import type { ReviewForm } from "@/contexts/performance-review/domain/review/review-form.entity"
import type { Context } from "@/env"
import { ForbiddenError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/review/review-cycle-repository"
import { ReviewFormRepository } from "@/contexts/performance-review/infrastructure/review/review-form-repository"
import type { ReviewFormDraft } from "@/contexts/performance-review/infrastructure/review/review-form-repository"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { inArray } from "drizzle-orm"

export type BulkFormInput = {
  subjectEmployeeId: number
  reviewerEmployeeId: number
  reviewerType: "self" | "manager" | "peer" | "subordinate"
}

export type Input = {
  session: Session
  cycleId: number
  forms: ReadonlyArray<BulkFormInput>
}

/**
 * 管理権限のある本人が、被評価者と評価者種別（self/manager/peer/subordinate）の組を
 * 一括で評価フォームとして作成する（360度評価）。作成されるフォームは hidden で始まる。
 */
export class CreateReviewFormsBulk {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ReadonlyArray<ReviewForm> | ApplicationError> {
    if (input.session.hasPermission("review:administer") === false) {
      return new ForbiddenError("cannot manage review cycles", "forbidden")
    }

    if (input.forms.length === 0) {
      return new ValidationError("no review forms to create", "empty_forms")
    }

    const cycle = await new ReviewCycleRepository(this.c).findById(input.cycleId)

    if (cycle instanceof Error) {
      return new UnexpectedError("failed to find review cycle", { cause: cycle })
    }

    if (cycle === null) {
      return new NotFoundError("review cycle not found", "cycle_not_found")
    }

    const missing = await this.findMissingEmployeeId(input.forms)

    if (missing instanceof Error) {
      return new UnexpectedError("failed to verify employees", { cause: missing })
    }

    if (missing !== null) {
      return new NotFoundError("employee not found", "employee_not_found")
    }

    const drafts: ReadonlyArray<ReviewFormDraft> = input.forms.map((form) => ({
      cycleId: input.cycleId,
      subjectEmployeeId: form.subjectEmployeeId,
      reviewerEmployeeId: form.reviewerEmployeeId,
      reviewerType: form.reviewerType,
    }))

    const created = await new ReviewFormRepository(this.c).createMany(drafts)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create review forms", { cause: created })
    }

    return created
  }

  /** 被評価者・評価者に実在しない社員 ID があれば 1 件返す。全て実在すれば null。 */
  private async findMissingEmployeeId(
    forms: ReadonlyArray<BulkFormInput>,
  ): Promise<number | null | Error> {
    try {
      const ids = new Set<number>()

      for (const form of forms) {
        ids.add(form.subjectEmployeeId)

        ids.add(form.reviewerEmployeeId)
      }

      const idList = Array.from(ids)

      const rows = await this.c.var.database
        .select({ id: employees.id })
        .from(employees)
        .where(inArray(employees.id, idList))

      const found = new Set(rows.map((row) => row.id))

      for (const id of idList) {
        if (found.has(id) === false) {
          return id
        }
      }

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to verify employees")
    }
  }
}
