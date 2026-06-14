import { canManageShift } from "@/lib/shift/can-manage-shift"
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

export type Forbidden = { reason: "forbidden" }

export type AssignmentNotFound = { reason: "assignment_not_found" }

export type PatternNotFound = { reason: "pattern_not_found" }

export type AlreadyPublished = { reason: "already_published" }

type ResolvedPattern = { patternId: number | null }

/**
 * 権限・パターンを確認し、シフト割当のパターン・日付・備考を変更する。
 */
export class UpdateShiftAssignment {
  constructor(private readonly c: Context) {}

  async run(
    input: Input,
  ): Promise<
    ShiftAssignment | Forbidden | AssignmentNotFound | PatternNotFound | AlreadyPublished | Error
  > {
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

    const resolved = await this.resolvePatternId(input.patternCode)

    if (resolved instanceof Error) {
      return resolved
    }

    if ("reason" in resolved) {
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
      return saved
    }

    // 0 行更新（null）は事前チェック後に並行 publish 等で状態が変わったケース。再取得して理由を判別する。
    if (saved === null) {
      const latest = await assignmentRepository.findById(input.assignmentId)

      if (latest instanceof Error) {
        return latest
      }

      if (latest === null) {
        return { reason: "assignment_not_found" }
      }

      if (latest.isModifiable === false) {
        return { reason: "already_published" }
      }

      return { reason: "assignment_not_found" }
    }

    return saved
  }

  // パターンコードを id に解決する。null は「パターン未指定」として patternId:null を返す。
  private async resolvePatternId(
    patternCode: string | null,
  ): Promise<ResolvedPattern | PatternNotFound | Error> {
    if (patternCode === null) {
      return { patternId: null }
    }

    const patternRepository = new ShiftPatternRepository(this.c)

    const pattern = await patternRepository.findByCode(patternCode)

    if (pattern instanceof Error) {
      return pattern
    }

    if (pattern === null) {
      return { reason: "pattern_not_found" }
    }

    return { patternId: pattern.id }
  }
}
