import type { Context } from "@/env"
import { AntisocialCheckRepository } from "@/contexts/antisocial-check/infrastructure/antisocial-check-repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  antisocialCheckId: string
  requesterId: number
}

export type Cancelled = { reason: "cancelled" }

/**
 * 反社チェック申請を取消する。本人以外と、確定済み申請の取消を拒否する。
 */
export class CancelAntisocialCheck {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | ApplicationError> {
    const antisocialCheckRepository = new AntisocialCheckRepository(this.c)

    const current = await antisocialCheckRepository.findById(command.antisocialCheckId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find antisocial check", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("antisocial check not found", "antisocial_check_not_found")
    }

    if (current.requesterId !== command.requesterId) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    if (current.status !== "requested") {
      return new ConflictError("antisocial check is not modifiable", "not_modifiable")
    }

    const deleted = await antisocialCheckRepository.delete(command.antisocialCheckId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete antisocial check", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("antisocial check is not modifiable", "not_modifiable")
    }

    return { reason: "cancelled" }
  }
}
