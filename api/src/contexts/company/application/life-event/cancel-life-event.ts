import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { LifeEventRepository } from "@/contexts/company/infrastructure/life-event/life-event-repository"

export type Command = {
  lifeEventId: string
  employeeId: number
}

export type Cancelled = { reason: "cancelled" }

/**
 * ライフイベント届出を取消する。本人以外と、承認済み届出の取消を拒否する。
 */
export class CancelLifeEvent {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | ApplicationError> {
    const lifeEventRepository = new LifeEventRepository(this.c)

    const current = await lifeEventRepository.findById(command.lifeEventId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find life event", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("life event not found", "life_event_not_found")
    }

    if (current.employeeId !== command.employeeId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    if (!current.isModifiable) {
      return new ConflictError("life event is not modifiable", "not_modifiable")
    }

    const deleted = await lifeEventRepository.delete(command.lifeEventId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete life event", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("life event is not modifiable", "not_modifiable")
    }

    return { reason: "cancelled" }
  }
}
