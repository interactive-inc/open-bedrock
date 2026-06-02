import { canManageShift } from "@/domain/shift/can-manage-shift"
import type { ShiftAssignment } from "@/domain/shift/shift-assignment"
import type { Context } from "@/env"
import { ShiftAssignmentRepository } from "@/infrastructure/shift/shift-assignment-repository"

export type Input = {
  viewerRole: string
  assignmentId: number
}

export type Forbidden = { reason: "forbidden" }

export type AssignmentNotFound = { reason: "assignment_not_found" }

/**
 * 権限を確認し、シフト割当を1件取得する。
 */
export class GetShiftAssignment {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ShiftAssignment | Forbidden | AssignmentNotFound | Error> {
    if (canManageShift(input.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const assignmentRepository = new ShiftAssignmentRepository(this.c)

    const assignment = await assignmentRepository.findById(input.assignmentId)

    if (assignment instanceof Error) {
      return assignment
    }

    if (assignment === null) {
      return { reason: "assignment_not_found" }
    }

    return assignment
  }
}
