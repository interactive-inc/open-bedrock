import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ShiftAssignment } from "@/contexts/shift/domain/shift-assignment.entity"
import type { Context } from "@/env"
import { ShiftAssignmentRepository } from "@/contexts/shift/infrastructure/shift-assignment-repository"

export type Input = {
  session: Session
  assignmentId: number
}

/**
 * 権限を確認し、シフト割当を1件取得する。
 */
export class GetShiftAssignment {
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

    return assignment
  }
}
