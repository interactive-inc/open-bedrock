import type { Session } from "@/contexts/company/domain/iam/session"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ShiftPattern } from "@/contexts/company/domain/shift/shift-pattern.entity"
import type { Context } from "@/env"
import { UniqueConstraintError } from "@/contexts/company/infrastructure/shared/unique-constraint-error"
import { ShiftPatternRepository } from "@/contexts/company/infrastructure/shift/shift-pattern-repository"

export type Input = {
  session: Session
  pattern: {
    code: string
    name: string
    startTime: string
    endTime: string
    breakMinutes: number
  }
}

/**
 * 権限を確認し、コード重複がなければシフトパターンを作る。
 */
export class CreateShiftPattern {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ShiftPattern | ApplicationError> {
    if (input.session.hasPermission("shift:manage") === false) {
      return new ForbiddenError("cannot manage shift", "forbidden")
    }

    const patternRepository = new ShiftPatternRepository(this.c)

    const existing = await patternRepository.findByCode(input.pattern.code)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find shift pattern", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("shift pattern code already exists", "code_conflict")
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
      return new ConflictError("shift pattern code already exists", "code_conflict")
    }

    if (result instanceof Error) {
      return new UnexpectedError("failed to create shift pattern", { cause: result })
    }

    return result
  }
}
