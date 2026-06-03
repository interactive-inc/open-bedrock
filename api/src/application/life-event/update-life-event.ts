import type { LifeEvent } from "@/domain/life-event/life-event"
import type { Context } from "@/env"
import { LifeEventRepository } from "@/infrastructure/life-event/life-event-repository"

export type Command = {
  lifeEventId: string
  employeeId: number
  eventType: string
  eventDate: string
  detail: string | null
}

export type LifeEventNotFound = { reason: "life_event_not_found" }

export type NotApplicant = { reason: "not_applicant" }

/**
 * ライフイベント届出の種別・発生日・詳細を変更する。本人以外の変更を拒否する。
 */
export class UpdateLifeEvent {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<LifeEvent | LifeEventNotFound | NotApplicant | Error> {
    const lifeEventRepository = new LifeEventRepository(this.c)

    const current = await lifeEventRepository.findById(command.lifeEventId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "life_event_not_found" }
    }

    if (current.employeeId !== command.employeeId) {
      return { reason: "not_applicant" }
    }

    const updated = current.withDetails({
      eventType: command.eventType,
      eventDate: command.eventDate,
      detail: command.detail,
    })

    return await lifeEventRepository.update(updated)
  }
}
