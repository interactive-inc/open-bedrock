import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { Commendation } from "@/contexts/commendation/domain/commendation.entity"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CommendationRepository } from "@/contexts/commendation/infrastructure/commendation-repository"

export type Command = {
  session: Session
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
    if (command.session.hasPermission("commendation:manage") === false) {
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
