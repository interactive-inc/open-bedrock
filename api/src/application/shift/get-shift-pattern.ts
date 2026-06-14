import { canManageShift } from "@/lib/shift/can-manage-shift"
import type { ShiftPattern } from "@/domain/shift/shift-pattern.entity"
import type { Context } from "@/env"
import { ShiftPatternRepository } from "@/infrastructure/shift/shift-pattern-repository"

export type Input = {
  viewerRole: string
  patternId: number
}

export type Forbidden = { reason: "forbidden" }

export type PatternNotFound = { reason: "pattern_not_found" }

/**
 * 権限を確認し、シフトパターンを1件取得する。
 */
export class GetShiftPattern {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ShiftPattern | Forbidden | PatternNotFound | Error> {
    if (canManageShift(input.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const patternRepository = new ShiftPatternRepository(this.c)

    const pattern = await patternRepository.findById(input.patternId)

    if (pattern instanceof Error) {
      return pattern
    }

    if (pattern === null) {
      return { reason: "pattern_not_found" }
    }

    return pattern
  }
}
