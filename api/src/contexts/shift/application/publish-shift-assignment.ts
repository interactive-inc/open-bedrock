import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ShiftAssignment } from "@/contexts/shift/domain/entities/shift-assignment.entity"
import type { ShiftAssignmentRepository } from "@/contexts/shift/infrastructure/repositories/shift-assignment.repository"

type Context = Readonly<{
  assignmentRepository: Pick<ShiftAssignmentRepository, "findById" | "markPublished">
}>

export type Input = {
  session: CompanySessionValue
  assignmentId: number
  publishedAt: string
}

/**
 * 権限を確認し、未公開の割当を公開済みにする。
 */
export class PublishShiftAssignment {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(input: Input): Promise<ShiftAssignment | ApplicationError> {
    if (input.session.hasPermission("shift:manage") === false) {
      return new ForbiddenError("cannot manage shift", "forbidden")
    }

    const assignment = await this.c.assignmentRepository.findById(input.assignmentId)

    if (assignment instanceof Error) {
      return new UnexpectedError("failed to find shift assignment", { cause: assignment })
    }

    if (assignment === null) {
      return new NotFoundError("shift assignment not found", "assignment_not_found")
    }

    if (assignment.publishedAt !== null) {
      return new ConflictError("shift assignment is already published", "already_published")
    }

    const published = await this.c.assignmentRepository.markPublished(
      input.assignmentId,
      input.publishedAt,
    )

    if (published instanceof Error) {
      return new UnexpectedError("failed to publish shift assignment", { cause: published })
    }

    // 0 行更新（null）は事前チェック後に並行 publish 等で状態が変わったケース。再取得して理由を判別する。
    if (published === null) {
      const latest = await this.c.assignmentRepository.findById(input.assignmentId)

      if (latest instanceof Error) {
        return new UnexpectedError("failed to find shift assignment", { cause: latest })
      }

      if (latest === null) {
        return new NotFoundError("shift assignment not found", "assignment_not_found")
      }

      return new ConflictError("shift assignment is already published", "already_published")
    }

    return published
  }
}
