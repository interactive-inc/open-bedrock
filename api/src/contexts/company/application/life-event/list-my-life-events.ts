import type { LifeEvent } from "@/contexts/company/domain/life-event/life-event.entity"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { LifeEventRepository } from "@/contexts/company/infrastructure/life-event/life-event-repository"

export type Command = {
  employeeId: number
  limit: number
  offset: number
}

/**
 * 届出者本人のライフイベント届出を一覧する。
 */
export class ListMyLifeEvents {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<LifeEvent> | ApplicationError> {
    const lifeEventRepository = new LifeEventRepository(this.c)

    const lifeEvents = await lifeEventRepository.findByEmployeeId({
      employeeId: command.employeeId,
      limit: command.limit,
      offset: command.offset,
    })

    if (lifeEvents instanceof Error) {
      return new UnexpectedError("failed to find life events", { cause: lifeEvents })
    }

    return lifeEvents
  }
}
