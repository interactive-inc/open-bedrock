import { canManagePositions } from "@/lib/position/can-manage-positions"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { PositionRepository } from "@/infrastructure/position/position-repository"

export type Command = {
  session: SessionPayload
  positionId: number
}

/**
 * 権限を確認し、役職マスタから1件削除する。
 */
export class DeletePosition {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<null | ApplicationError> {
    const repository = new PositionRepository(this.c)

    if (canManagePositions(command.session) === false) {
      return new ForbiddenError("cannot manage positions", "forbidden")
    }

    const existing = await repository.findById(command.positionId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find position", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("position not found", "position_not_found")
    }

    const deleted = await repository.delete(command.positionId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete position", { cause: deleted })
    }

    return null
  }
}
