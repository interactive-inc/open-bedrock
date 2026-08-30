import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { Resignation } from "@/contexts/resignation/domain/entities/resignation.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ResignationRepository } from "@/contexts/resignation/infrastructure/repositories/resignation.repository"

export type Command = {
  session: CompanySessionValue
  resignationId: string
}

/** 退職申請を受理する。 */
export class AcceptResignation {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<Resignation | ApplicationError> {
    if (command.session.hasPermission("resignation:manage") === false) {
      return new ForbiddenError("cannot manage resignations", "forbidden")
    }

    const resignationRepository = new ResignationRepository(this.c)

    const current = await resignationRepository.findById(command.resignationId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find resignation", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("resignation not found", "resignation_not_found")
    }

    const next = current.withAccepted()

    if (next instanceof Resignation === false) {
      return new ConflictError("resignation is not in a transitionable state", next.reason)
    }

    const updated = await resignationRepository.updateStatus({
      id: current.id,
      fromStatus: current.status,
      toStatus: next.status,
    })

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update resignation status", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError("resignation is not in a transitionable state", "invalid_transition")
    }

    return updated
  }
}
