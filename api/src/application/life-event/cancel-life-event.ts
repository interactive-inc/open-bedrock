import type { Context } from "@/env"
import { LifeEventRepository } from "@/infrastructure/life-event/life-event-repository"

export type Command = {
  lifeEventId: string
  employeeId: number
}

export type LifeEventNotFound = { reason: "life_event_not_found" }

export type NotApplicant = { reason: "not_applicant" }

export type NotModifiable = { reason: "not_modifiable" }

export type Cancelled = { reason: "cancelled" }

/**
 * ライフイベント届出を取消する。本人以外と、承認済み届出の取消を拒否する。
 */
export class CancelLifeEvent {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Cancelled | LifeEventNotFound | NotApplicant | NotModifiable | Error> {
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

    if (!current.isModifiable) {
      return { reason: "not_modifiable" }
    }

    const deleted = await lifeEventRepository.delete(command.lifeEventId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "cancelled" }
  }
}
