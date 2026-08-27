import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Session } from "@/lib/auth/session"
import { DisciplinaryAction } from "@/contexts/disciplinary-action/domain/entities/disciplinary-action.entity"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { DisciplinaryActionRepository } from "@/contexts/disciplinary-action/infrastructure/repositories/disciplinary-action.repository"

export type Command = {
  session: Session
  employeeId: EmployeeId
  kind: string
  summary: string
  decidedOn: string
  createdAt: string
}

/**
 * 権限を確認し、社員の懲戒を1件記録する。非公開のため本人にも開かない。
 */
export class CreateDisciplinaryAction {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<DisciplinaryAction | ApplicationError> {
    if (command.session.hasPermission("disciplinary_action:manage") === false) {
      return new ForbiddenError("cannot manage disciplinary actions", "forbidden")
    }

    const repository = new DisciplinaryActionRepository(this.c)

    const action = DisciplinaryAction.create({
      employeeId: command.employeeId,
      kind: command.kind,
      summary: command.summary,
      decidedOn: command.decidedOn,
      createdAt: command.createdAt,
    })

    const created = await repository.create(action)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create disciplinary action", { cause: created })
    }

    return created
  }
}
