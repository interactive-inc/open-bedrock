import type { Session } from "@/lib/auth/session"
import { Resignation } from "@/contexts/resignation/domain/entities/resignation.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ResignationRepository } from "@/contexts/resignation/infrastructure/resignation.repository"

export type Action = "accept" | "reject"

export type Command = {
  session: Session
  resignationId: string
  action: Action
}

/**
 * 人事が退職申請の状態を代理で進める。requested のみ accepted/rejected へ遷移でき、
 * それ以外の現在状態からの遷移は 409 とする。
 */
export class AdvanceResignation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Resignation | ApplicationError> {
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

    const next = command.action === "accept" ? current.withAccepted() : current.withRejected()

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
