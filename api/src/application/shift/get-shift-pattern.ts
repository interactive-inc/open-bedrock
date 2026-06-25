import { canManageShift } from "@/lib/shift/can-manage-shift"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ShiftPattern } from "@/domain/shift/shift-pattern.entity"
import type { Context } from "@/env"
import { ShiftPatternRepository } from "@/infrastructure/shift/shift-pattern-repository"

export type Input = {
  viewerRole: string
  patternId: number
}

/**
 * 権限を確認し、シフトパターンを1件取得する。
 */
export class GetShiftPattern {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ShiftPattern | ApplicationError> {
    if (canManageShift(input.viewerRole) === false) {
      return new ForbiddenError("cannot manage shift", "forbidden")
    }

    const patternRepository = new ShiftPatternRepository(this.c)

    const pattern = await patternRepository.findById(input.patternId)

    if (pattern instanceof Error) {
      return new UnexpectedError("failed to find shift pattern", { cause: pattern })
    }

    if (pattern === null) {
      return new NotFoundError("shift pattern not found", "pattern_not_found")
    }

    return pattern
  }
}
