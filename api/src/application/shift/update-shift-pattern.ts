import { canManageShift } from "@/domain/shift/can-manage-shift"
import type { ShiftPattern } from "@/domain/shift/shift-pattern"
import type { Context } from "@/env"
import { ShiftPatternRepository } from "@/infrastructure/shift/shift-pattern-repository"

export type Input = {
  viewerRole: string
  patternId: number
  code: string
  name: string
  startTime: string
  endTime: string
  breakMinutes: number
}

export type Forbidden = { reason: "forbidden" }

export type PatternNotFound = { reason: "pattern_not_found" }

export type CodeConflict = { reason: "code_conflict" }

/**
 * 権限・コード重複を確認し、シフトパターンの内容を変更する。
 */
export class UpdateShiftPattern {
  constructor(private readonly c: Context) {}

  async run(
    input: Input,
  ): Promise<ShiftPattern | Forbidden | PatternNotFound | CodeConflict | Error> {
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

    const conflict = await this.findCodeConflict(input.code, input.patternId)

    if (conflict instanceof Error) {
      return conflict
    }

    if (conflict.reason === "code_conflict") {
      return conflict
    }

    const saved = await patternRepository.update(
      current.withDetails({
        code: input.code,
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        breakMinutes: input.breakMinutes,
      }),
    )

    if (saved instanceof Error) {
      return saved
    }

    if (saved === null) {
      return { reason: "pattern_not_found" }
    }

    return saved
  }

  // 変更後コードが自分以外のパターンと重複しないか確認する。
  private async findCodeConflict(
    code: string,
    patternId: number,
  ): Promise<CodeConflict | { reason: "ok" } | Error> {
    const patternRepository = new ShiftPatternRepository(this.c)

    const existing = await patternRepository.findByCode(code)

    if (existing instanceof Error) {
      return existing
    }

    if (existing !== null && existing.id !== patternId) {
      return { reason: "code_conflict" }
    }

    return { reason: "ok" }
  }
}
