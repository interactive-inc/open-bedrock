import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ShiftPattern } from "@/contexts/shift/domain/shift-pattern.entity"
import type { Context } from "@/env"
import { ShiftPatternRepository } from "@/contexts/shift/infrastructure/shift-pattern-repository"

export type Input = {
  session: Session
  patternId: number
}

/**
 * 権限を確認し、シフトパターンを1件取得する。
 */
export class GetShiftPattern {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ShiftPattern | ApplicationError> {
    if (input.session.hasPermission("shift:manage") === false) {
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
