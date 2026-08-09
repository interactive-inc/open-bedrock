import type { Session } from "@/domain/company/iam/session"
import { Position } from "@/domain/position/position.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { PositionRepository } from "@/infrastructure/position/position-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"

export type Command = {
  session: Session
  positionId: number
  code: string
  name: string
  rank: number
  description: string | null
}

/**
 * 権限を確認し、役職マスタの定義を差し替える。
 */
export class UpdatePosition {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Position | ApplicationError> {
    const repository = new PositionRepository(this.c)

    if (command.session.hasPermission("position:manage") === false) {
      return new ForbiddenError("cannot manage positions", "forbidden")
    }

    const existing = await repository.findById(command.positionId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find position", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("position not found", "position_not_found")
    }

    const position = existing.withDetails({
      code: command.code,
      name: command.name,
      rank: command.rank,
      description: command.description,
    })

    const updated = await repository.update(position)

    if (updated instanceof UniqueConstraintError) {
      return new ConflictError("position code already exists", "position_code_conflict")
    }

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update position", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("position not found", "position_not_found")
    }

    return updated
  }
}
