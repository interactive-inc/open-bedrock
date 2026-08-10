import type { Session } from "@/domain/company/iam/session"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { ApplicationError } from "@/lib/errors"
import type { ShiftPattern } from "@/domain/shift/shift-pattern.entity"
import type { Context } from "@/env"
import { ShiftPatternRepository } from "@/infrastructure/shift/shift-pattern-repository"

export type Input = {
  session: Session
  patternId: number
  code: string
  name: string
  startTime: string
  endTime: string
  breakMinutes: number
}

/**
 * 権限・コード重複を確認し、シフトパターンの内容を変更する。
 */
export class UpdateShiftPattern {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ShiftPattern | ApplicationError> {
    if (input.session.hasPermission("shift:manage") === false) {
      return new ForbiddenError("cannot manage shift", "forbidden")
    }

    const patternRepository = new ShiftPatternRepository(this.c)

    const current = await patternRepository.findById(input.patternId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find shift pattern", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("shift pattern not found", "pattern_not_found")
    }

    const conflict = await this.findCodeConflict(input.code, input.patternId)

    if (conflict instanceof ApplicationError) {
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
      return new UnexpectedError("failed to update shift pattern", { cause: saved })
    }

    if (saved === null) {
      return new NotFoundError("shift pattern not found", "pattern_not_found")
    }

    return saved
  }

  /** 変更後コードが自分以外のパターンと重複しないか確認する。重複なしは null を返す。 */
  private async findCodeConflict(
    code: string,
    patternId: number,
  ): Promise<null | ApplicationError> {
    const patternRepository = new ShiftPatternRepository(this.c)

    const existing = await patternRepository.findByCode(code)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find shift pattern", { cause: existing })
    }

    if (existing !== null && existing.id !== patternId) {
      return new ConflictError("shift pattern code already exists", "code_conflict")
    }

    return null
  }
}
