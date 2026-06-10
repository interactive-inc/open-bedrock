import type { LifeEvent } from "@/domain/life-event/life-event"
import type { Context } from "@/env"
import { LifeEventRepository } from "@/infrastructure/life-event/life-event-repository"

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

  async run(command: Command): Promise<ReadonlyArray<LifeEvent> | Error> {
    const lifeEventRepository = new LifeEventRepository(this.c)

    return await lifeEventRepository.findByEmployeeId({
      employeeId: command.employeeId,
      limit: command.limit,
      offset: command.offset,
    })
  }
}
