import { LifeEvent } from "@/contexts/life-event/domain/entities/life-event.entity"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { LifeEventRepository } from "@/contexts/life-event/infrastructure/life-event.repository"
import type { LifeEventType } from "@/lib/schemas"

export type Command = {
  employeeId: number
  eventType: LifeEventType
  eventDate: string
  detail: string | null
  createdAt: string
}

/**
 * ライフイベント届出を作成する。status は "submitted" で登録する。
 */
export class CreateLifeEvent {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<LifeEvent | ApplicationError> {
    const lifeEventRepository = new LifeEventRepository(this.c)

    const lifeEvent = LifeEvent.create({
      employeeId: command.employeeId,
      eventType: command.eventType,
      eventDate: command.eventDate,
      detail: command.detail,
      createdAt: command.createdAt,
    })

    const created = await lifeEventRepository.create(lifeEvent)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create life event", { cause: created })
    }

    return created
  }
}
