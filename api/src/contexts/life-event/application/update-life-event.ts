import type { LifeEvent } from "@/contexts/life-event/domain/entities/life-event.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { LifeEventRepository } from "@/contexts/life-event/infrastructure/repositories/life-event.repository"
import type { LifeEventType } from "@/lib/schemas"

export type Command = {
  lifeEventId: string
  employeeId: number
  eventType: LifeEventType
  eventDate: string
  detail: string | null
}

/**
 * ライフイベント届出の種別・発生日・詳細を変更する。本人以外と、承認済み届出の変更を拒否する。
 */
export class UpdateLifeEvent {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<LifeEvent | ApplicationError> {
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

    const updated = current.withDetails({
      eventType: command.eventType,
      eventDate: command.eventDate,
      detail: command.detail,
    })

    const saved = await lifeEventRepository.update(updated)

    if (saved instanceof Error) {
      return new UnexpectedError("failed to update life event", { cause: saved })
    }

    if (saved === null) {
      return new ConflictError("life event is not modifiable", "not_modifiable")
    }

    return saved
  }
}
