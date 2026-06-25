import type { LifeEvent } from "@/domain/life-event/life-event.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { LifeEventRepository } from "@/infrastructure/life-event/life-event-repository"

export type Command = {
  lifeEventId: string
  employeeId: number
}

/**
 * ライフイベント届出を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetLifeEvent {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<LifeEvent | ApplicationError> {
    const lifeEventRepository = new LifeEventRepository(this.c)

    const lifeEvent = await lifeEventRepository.findById(command.lifeEventId)

    if (lifeEvent instanceof Error) {
      return new UnexpectedError("failed to find life event", { cause: lifeEvent })
    }

    if (lifeEvent === null) {
      return new NotFoundError("life event not found", "life_event_not_found")
    }

    if (lifeEvent.employeeId !== command.employeeId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    return lifeEvent
  }
}
