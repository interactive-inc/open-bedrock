import { canManageShift } from "@/lib/shift/can-manage-shift"
import type { Context } from "@/env"
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
 * チェックと削除はリポジトリ層で atomic に行われるため、競合状態でも安全。
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

    const deleted = await patternRepository.delete(input.patternId)

    if (deleted instanceof Error) {
      return deleted
    }

    // 0 行削除 — 存在確認後に割当が挿入された（競合）か、まだ割当が参照中。
    if (deleted === null) {
      return { reason: "pattern_in_use" }
    }

    return { reason: "deleted" }
  }
}
