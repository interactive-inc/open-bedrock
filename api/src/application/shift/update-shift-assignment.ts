import { canManageShift } from "@/lib/shift/can-manage-shift"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { ApplicationError } from "@/lib/errors"
import type { ShiftAssignment } from "@/domain/shift/shift-assignment.entity"
import type { Context } from "@/env"
import { ShiftAssignmentRepository } from "@/infrastructure/shift/shift-assignment-repository"
import { ShiftPatternRepository } from "@/infrastructure/shift/shift-pattern-repository"

export type Input = {
  viewerRole: string
  assignmentId: number
  patternCode: string | null
  date: string
  note: string | null
}

type ResolvedPattern = { patternId: number | null }

/**
 * 権限・パターンを確認し、シフト割当のパターン・日付・備考を変更する。
 */
export class UpdateShiftAssignment {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ShiftAssignment | ApplicationError> {
    if (canManageShift(input.viewerRole) === false) {
      return new ForbiddenError("cannot manage shift", "forbidden")
    }

    const assignmentRepository = new ShiftAssignmentRepository(this.c)

    const current = await assignmentRepository.findById(input.assignmentId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find shift assignment", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("shift assignment not found", "assignment_not_found")
    }

    if (current.isModifiable === false) {
      return new ConflictError("shift assignment is already published", "already_published")
    }

    const resolved = await this.resolvePatternId(input.patternCode)

    if (resolved instanceof ApplicationError) {
      return resolved
    }

    const saved = await assignmentRepository.update(
      current.withDetails({
        patternId: resolved.patternId,
        date: input.date,
        note: input.note,
      }),
    )

    if (saved instanceof Error) {
      return new UnexpectedError("failed to update shift assignment", { cause: saved })
    }

    // 0 行更新（null）は事前チェック後に並行 publish 等で状態が変わったケース。再取得して理由を判別する。
    if (saved === null) {
      const latest = await assignmentRepository.findById(input.assignmentId)

      if (latest instanceof Error) {
        return new UnexpectedError("failed to find shift assignment", { cause: latest })
      }

      if (latest === null) {
        return new NotFoundError("shift assignment not found", "assignment_not_found")
      }

      if (latest.isModifiable === false) {
        return new ConflictError("shift assignment is already published", "already_published")
      }

      return new NotFoundError("shift assignment not found", "assignment_not_found")
    }

    return saved
  }

  // パターンコードを id に解決する。null は「パターン未指定」として patternId:null を返す。
  private async resolvePatternId(
    patternCode: string | null,
  ): Promise<ResolvedPattern | ApplicationError> {
    if (patternCode === null) {
      return { patternId: null }
    }

    const patternRepository = new ShiftPatternRepository(this.c)

    const pattern = await patternRepository.findByCode(patternCode)

    if (pattern instanceof Error) {
      return new UnexpectedError("failed to find shift pattern", { cause: pattern })
    }

    if (pattern === null) {
      return new NotFoundError("shift pattern not found", "pattern_not_found")
    }

    return { patternId: pattern.id }
  }
}
