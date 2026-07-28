import type { Session } from "@/lib/auth/session"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ShiftPatternRepository } from "@/infrastructure/shift/shift-pattern-repository"

export type Input = {
  session: Session
  patternId: number
}

export type Deleted = { reason: "deleted" }

/**
 * 権限を確認し、割当から参照されていないシフトパターンを削除する。
 * チェックと削除はリポジトリ層で atomic に行われるため、競合状態でも安全。
 */
export class DeleteShiftPattern {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<Deleted | ApplicationError> {
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

    const deleted = await patternRepository.delete(input.patternId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete shift pattern", { cause: deleted })
    }

    // 0 行削除 — 存在確認後に割当が挿入された（競合）か、まだ割当が参照中。
    if (deleted === null) {
      return new ConflictError("shift pattern is in use", "pattern_in_use")
    }

    return { reason: "deleted" }
  }
}
