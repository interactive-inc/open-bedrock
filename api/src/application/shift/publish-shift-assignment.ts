import { canManageShift } from "@/domain/shift/can-manage-shift"
import type { ShiftAssignment } from "@/domain/shift/shift-assignment"
import type { Context } from "@/env"
import { ShiftAssignmentRepository } from "@/infrastructure/shift/shift-assignment-repository"

export type Input = {
  viewerRole: string
  assignmentId: number
  publishedAt: string
}

export type Forbidden = { reason: "forbidden" }

export type AssignmentNotFound = { reason: "assignment_not_found" }

export type AlreadyPublished = { reason: "already_published" }

/**
 * 権限を確認し、未公開の割当を公開済みにする。
 */
export class PublishShiftAssignment {
  constructor(private readonly c: Context) {}

  async run(
    input: Input,
  ): Promise<ShiftAssignment | Forbidden | AssignmentNotFound | AlreadyPublished | Error> {
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

    if (assignment.publishedAt !== null) {
      return { reason: "already_published" }
    }

    const published = await assignmentRepository.markPublished(
      input.assignmentId,
      input.publishedAt,
    )

    if (published instanceof Error) {
      return published
    }

    // 0 行更新（null）は事前チェック後に並行 publish 等で状態が変わったケース。再取得して理由を判別する。
    if (published === null) {
      const latest = await assignmentRepository.findById(input.assignmentId)

      if (latest instanceof Error) {
        return latest
      }

      if (latest === null) {
        return { reason: "assignment_not_found" }
      }

      return { reason: "already_published" }
    }

    return published
  }
}
