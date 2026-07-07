import { Commendation } from "@/domain/commendation/commendation.entity"
import { canManageCommendations } from "@/lib/commendation/can-manage-commendations"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { CommendationRepository } from "@/infrastructure/commendation/commendation-repository"

export type Command = {
  session: SessionPayload
  employeeId: number
  title: string
  reason: string
  awardedOn: string
  createdAt: string
}

/**
 * 権限を確認し、社員の表彰を1件記録する。
 */
export class CreateCommendation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Commendation | ApplicationError> {
    if (canManageCommendations(command.session) === false) {
      return new ForbiddenError("cannot manage commendations", "forbidden")
    }

    const repository = new CommendationRepository(this.c)

    const commendation = Commendation.create({
      employeeId: command.employeeId,
      title: command.title,
      reason: command.reason,
      awardedOn: command.awardedOn,
      createdAt: command.createdAt,
    })

    const created = await repository.create(commendation)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create commendation", { cause: created })
    }

    return created
  }
}
