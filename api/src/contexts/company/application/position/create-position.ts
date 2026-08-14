import type { Session } from "@/contexts/company/domain/iam/session"
import { Position } from "@/contexts/company/domain/position/position.entity"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { PositionRepository } from "@/contexts/company/infrastructure/position/position-repository"
import { UniqueConstraintError } from "@/contexts/company/infrastructure/shared/unique-constraint-error"

export type Command = {
  session: Session
  code: string
  name: string
  rank: number
  description: string | null
  createdAt: string
}

/**
 * 権限と重複コードを確認し、新しい役職をマスタに登録する。
 */
export class CreatePosition {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Position | ApplicationError> {
    const repository = new PositionRepository(this.c)

    if (command.session.hasPermission("position:manage") === false) {
      return new ForbiddenError("cannot manage positions", "forbidden")
    }

    const position = Position.create({
      code: command.code,
      name: command.name,
      rank: command.rank,
      description: command.description,
      createdAt: command.createdAt,
    })

    const created = await repository.create(position)

    if (created instanceof UniqueConstraintError) {
      return new ConflictError("position code already exists", "position_code_conflict")
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to create position", { cause: created })
    }

    return created
  }
}
