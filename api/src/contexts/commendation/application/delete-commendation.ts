import type { Session } from "@/lib/auth/session"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CommendationRepository } from "@/contexts/commendation/infrastructure/repositories/commendation.repository"
import type { Commendation } from "@/contexts/commendation/domain/entities/commendation.entity"

export type Command = {
  session: Session
  id: number
}

/**
 * 権限を確認し、表彰の記録を1件削除する。存在しなければ 404。
 */
export class DeleteCommendation {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<true | ApplicationError> {
    if (command.session.hasPermission("commendation:manage") === false) {
      return new ForbiddenError("cannot manage commendations", "forbidden")
    }

    const repository = new CommendationRepository(this.c)

    const commendation: Commendation | null | Error = await repository.findById(command.id)

    if (commendation instanceof Error) {
      return new UnexpectedError("failed to find commendation", { cause: commendation })
    }

    if (commendation === null) {
      return new NotFoundError("commendation not found", "commendation_not_found")
    }

    const deleted = await repository.delete(commendation)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete commendation", { cause: deleted })
    }

    if (deleted === false) {
      return new NotFoundError("commendation not found", "commendation_not_found")
    }

    return true
  }
}
