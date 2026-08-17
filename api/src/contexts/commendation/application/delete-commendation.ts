import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CommendationRepository } from "@/contexts/commendation/infrastructure/commendation-repository"

export type Command = {
  session: Session
  id: number
}

/**
 * 権限を確認し、表彰の記録を1件削除する。存在しなければ 404。
 */
export class DeleteCommendation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<true | ApplicationError> {
    if (command.session.hasPermission("commendation:manage") === false) {
      return new ForbiddenError("cannot manage commendations", "forbidden")
    }

    const repository = new CommendationRepository(this.c)

    const deleted = await repository.delete(command.id)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete commendation", { cause: deleted })
    }

    if (deleted === false) {
      return new NotFoundError("commendation not found", "commendation_not_found")
    }

    return true
  }
}
