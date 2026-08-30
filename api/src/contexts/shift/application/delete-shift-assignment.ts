import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ShiftAssignmentRepository } from "@/contexts/shift/infrastructure/repositories/shift-assignment.repository"
import type { ShiftAssignment } from "@/contexts/shift/domain/entities/shift-assignment.entity"

export type Input = {
  session: CompanySessionValue
  assignmentId: number
}

export type Deleted = { reason: "deleted" }

/**
 * 権限を確認し、シフト割当を削除する。
 */
export class DeleteShiftAssignment {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(input: Input): Promise<Deleted | ApplicationError> {
    if (input.session.hasPermission("shift:manage") === false) {
      return new ForbiddenError("cannot manage shift", "forbidden")
    }

    const assignmentRepository = new ShiftAssignmentRepository(this.c)

    const current: ShiftAssignment | null | Error = await assignmentRepository.findById(
      input.assignmentId,
    )

    if (current instanceof Error) {
      return new UnexpectedError("failed to find shift assignment", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("shift assignment not found", "assignment_not_found")
    }

    if (current.isModifiable === false) {
      return new ConflictError("shift assignment is already published", "already_published")
    }

    const deleted = await assignmentRepository.delete(current)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete shift assignment", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("shift assignment is already published", "already_published")
    }

    return { reason: "deleted" }
  }
}
