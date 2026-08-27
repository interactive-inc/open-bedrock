import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Session } from "@/lib/auth/session"
import { Commendation } from "@/contexts/commendation/domain/entities/commendation.entity"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CommendationRepository } from "@/contexts/commendation/infrastructure/repositories/commendation.repository"

export type Command = {
  session: Session
  employeeId: EmployeeId
  title: string
  reason: string
  awardedOn: string
  createdAt: string
}

/**
 * 権限を確認し、社員の表彰を1件記録する。
 */
export class CreateCommendation {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

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
