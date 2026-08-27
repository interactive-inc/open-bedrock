import type { Session } from "@/lib/auth/session"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { PositionRepository } from "@/contexts/administration/infrastructure/repositories/position/position.repository"
import type { Position } from "@/contexts/administration/domain/entities/position.entity"

export type Command = {
  session: Session
  positionId: number
}

/**
 * 権限を確認し、役職マスタから1件削除する。
 * 従業員が現に使っている役職名（employees.position が一致）は削除を拒否する。
 */
export class DeletePosition {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<null | ApplicationError> {
    const repository = new PositionRepository(this.c)

    if (command.session.hasPermission("position:manage") === false) {
      return new ForbiddenError("cannot manage positions", "forbidden")
    }

    const existing: Position | null | Error = await repository.findById(command.positionId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find position", {
        cause: existing,
      })
    }

    if (existing === null) {
      return new NotFoundError("position not found", "position_not_found")
    }

    const inUse = await repository.countEmployeesByPositionName(existing.name)

    if (inUse instanceof Error) {
      return new UnexpectedError("failed to check position usage", {
        cause: inUse,
      })
    }

    if (inUse > 0) {
      return new ConflictError("position is in use by employees", "position_in_use")
    }

    const deleted = await repository.delete(existing)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete position", {
        cause: deleted,
      })
    }

    return null
  }
}
