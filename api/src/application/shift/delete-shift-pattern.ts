import { canManageShift } from "@/domain/shift/can-manage-shift"
import type { Context } from "@/env"
import { ShiftAssignmentRepository } from "@/infrastructure/shift/shift-assignment-repository"
import { ShiftPatternRepository } from "@/infrastructure/shift/shift-pattern-repository"

export type Input = {
  viewerRole: string
  patternId: number
}

export type Forbidden = { reason: "forbidden" }

export type PatternNotFound = { reason: "pattern_not_found" }

export type PatternInUse = { reason: "pattern_in_use" }

export type Deleted = { reason: "deleted" }

/**
 * 権限を確認し、割当から参照されていないシフトパターンを削除する。
 */
export class DeleteShiftPattern {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<Deleted | Forbidden | PatternNotFound | PatternInUse | Error> {
    if (canManageShift(input.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const patternRepository = new ShiftPatternRepository(this.c)

    const current = await patternRepository.findById(input.patternId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "pattern_not_found" }
    }

    const assignmentRepository = new ShiftAssignmentRepository(this.c)

    const referencing = await assignmentRepository.findByPatternId(input.patternId)

    if (referencing instanceof Error) {
      return referencing
    }

    if (referencing.length > 0) {
      return { reason: "pattern_in_use" }
    }

    const deleted = await patternRepository.delete(input.patternId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "deleted" }
  }
}
