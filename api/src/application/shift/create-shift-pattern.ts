import { canManageShift } from "@/lib/shift/can-manage-shift"
import { ShiftPattern } from "@/domain/shift/shift-pattern.entity"
import type { Context } from "@/env"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { ShiftPatternRepository } from "@/infrastructure/shift/shift-pattern-repository"

export type Input = {
  viewerRole: string
  pattern: {
    code: string
    name: string
    startTime: string
    endTime: string
    breakMinutes: number
  }
}

export type Forbidden = { reason: "forbidden" }

export type CodeConflict = { reason: "code_conflict" }

/**
 * 権限を確認し、コード重複がなければシフトパターンを作る。
 */
export class CreateShiftPattern {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ShiftPattern | Forbidden | CodeConflict | Error> {
    if (canManageShift(input.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const patternRepository = new ShiftPatternRepository(this.c)

    const existing = await patternRepository.findByCode(input.pattern.code)

    if (existing instanceof Error) {
      return existing
    }

    if (existing !== null) {
      return { reason: "code_conflict" }
    }

    const pattern = ShiftPattern.create({
      code: input.pattern.code,
      name: input.pattern.name,
      startTime: input.pattern.startTime,
      endTime: input.pattern.endTime,
      breakMinutes: input.pattern.breakMinutes,
    })

    const result = await patternRepository.create(pattern)

    if (result instanceof UniqueConstraintError) {
      return { reason: "code_conflict" }
    }

    return result
  }
}
