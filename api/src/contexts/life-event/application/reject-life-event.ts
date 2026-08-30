import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { LifeEvent } from "@/contexts/life-event/domain/entities/life-event.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { LifeEventRepository } from "@/contexts/life-event/infrastructure/repositories/life-event.repository"

export type Command = {
  session: CompanySessionValue
  lifeEventId: string
}

/** ライフイベント届出を却下する。 */
export class RejectLifeEvent {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<LifeEvent | ApplicationError> {
    if (command.session.hasPermission("life_event:manage") === false) {
      return new ForbiddenError("cannot manage life events", "forbidden")
    }

    const lifeEventRepository = new LifeEventRepository(this.c)

    const current = await lifeEventRepository.findById(command.lifeEventId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find life event", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("life event not found", "life_event_not_found")
    }

    const next = current.withRejected()

    if (next instanceof LifeEvent === false) {
      return new ConflictError("life event is not in a transitionable state", next.reason)
    }

    const updated = await lifeEventRepository.updateStatus({
      id: current.id,
      fromStatus: current.status,
      toStatus: next.status,
    })

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update life event status", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError("life event is not in a transitionable state", "invalid_transition")
    }

    return updated
  }
}
