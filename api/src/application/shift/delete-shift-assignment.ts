import { canManageShift } from "@/lib/shift/can-manage-shift"
import type { Context } from "@/env"
import { ShiftAssignmentRepository } from "@/infrastructure/shift/shift-assignment-repository"

export type Input = {
  viewerRole: string
  assignmentId: number
}

export type Forbidden = { reason: "forbidden" }

export type AssignmentNotFound = { reason: "assignment_not_found" }

export type AlreadyPublished = { reason: "already_published" }

export type Deleted = { reason: "deleted" }

/**
 * 権限を確認し、シフト割当を削除する。
 */
export class DeleteShiftAssignment {
  constructor(private readonly c: Context) {}

  async run(
    input: Input,
  ): Promise<Deleted | Forbidden | AssignmentNotFound | AlreadyPublished | Error> {
    if (canManageShift(input.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const assignmentRepository = new ShiftAssignmentRepository(this.c)

    const current = await assignmentRepository.findById(input.assignmentId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "assignment_not_found" }
    }

    if (current.isModifiable === false) {
      return { reason: "already_published" }
    }

    const deleted = await assignmentRepository.delete(input.assignmentId)

    if (deleted instanceof Error) {
      return deleted
    }

    if (deleted === null) {
      return { reason: "already_published" }
    }

    return { reason: "deleted" }
  }
}
