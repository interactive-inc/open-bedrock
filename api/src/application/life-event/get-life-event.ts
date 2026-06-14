import type { LifeEvent } from "@/domain/life-event/life-event.entity"
import type { Context } from "@/env"
import { LifeEventRepository } from "@/infrastructure/life-event/life-event-repository"

export type Command = {
  lifeEventId: string
  employeeId: number
}

export type LifeEventNotFound = { reason: "life_event_not_found" }

export type NotApplicant = { reason: "not_applicant" }

/**
 * ライフイベント届出を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetLifeEvent {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<LifeEvent | LifeEventNotFound | NotApplicant | Error> {
    const lifeEventRepository = new LifeEventRepository(this.c)

    const lifeEvent = await lifeEventRepository.findById(command.lifeEventId)

    if (lifeEvent instanceof Error) {
      return lifeEvent
    }

    if (lifeEvent === null) {
      return { reason: "life_event_not_found" }
    }

    if (lifeEvent.employeeId !== command.employeeId) {
      return { reason: "not_applicant" }
    }

    return lifeEvent
  }
}
