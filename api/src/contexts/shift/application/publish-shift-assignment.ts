import type { Session } from "@/contexts/company/domain/iam/session"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ShiftAssignment } from "@/contexts/shift/domain/shift-assignment.entity"
import type { Context } from "@/env"
import { ShiftAssignmentRepository } from "@/contexts/shift/infrastructure/shift-assignment-repository"

export type Input = {
  session: Session
  assignmentId: number
  publishedAt: string
}

/**
 * 権限を確認し、未公開の割当を公開済みにする。
 */
export class PublishShiftAssignment {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ShiftAssignment | ApplicationError> {
    if (input.session.hasPermission("shift:manage") === false) {
      return new ForbiddenError("cannot manage shift", "forbidden")
    }

    const assignmentRepository = new ShiftAssignmentRepository(this.c)

    const assignment = await assignmentRepository.findById(input.assignmentId)

    if (assignment instanceof Error) {
      return new UnexpectedError("failed to find shift assignment", { cause: assignment })
    }

    if (assignment === null) {
      return new NotFoundError("shift assignment not found", "assignment_not_found")
    }

    if (assignment.publishedAt !== null) {
      return new ConflictError("shift assignment is already published", "already_published")
    }

    const published = await assignmentRepository.markPublished(
      input.assignmentId,
      input.publishedAt,
    )

    if (published instanceof Error) {
      return new UnexpectedError("failed to publish shift assignment", { cause: published })
    }

    // 0 行更新（null）は事前チェック後に並行 publish 等で状態が変わったケース。再取得して理由を判別する。
    if (published === null) {
      const latest = await assignmentRepository.findById(input.assignmentId)

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
