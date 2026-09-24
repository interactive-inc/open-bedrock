import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { LifeEvent } from "@/contexts/life-event/domain/entities/life-event.entity"
import { ConflictError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { LifeEventRepository } from "@/contexts/life-event/infrastructure/repositories/life-event.repository"
import { isLifeEventRecordSourceFrozenError } from "@/contexts/life-event/infrastructure/repositories/lib/is-life-event-record-source-frozen-error"
import type { LifeEventType } from "@/contexts/life-event/domain/definitions/life-event-type.definition"

type Context = Readonly<{
  lifeEventRepository: Pick<LifeEventRepository, "create">
}>

export type Command = {
  employeeId: EmployeeId
  eventType: LifeEventType
  eventDate: string
  detail: string | null
  createdAt: string
}

/**
 * ライフイベント届出を作成する。status は "submitted" で登録する。
 */
export class CreateLifeEvent {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<LifeEvent | ApplicationError> {
    const lifeEvent = LifeEvent.create({
      employeeId: command.employeeId,
      eventType: command.eventType,
      eventDate: command.eventDate,
      detail: command.detail,
      createdAt: command.createdAt,
    })

    const created = await this.c.lifeEventRepository.create(lifeEvent)

    if (created instanceof Error) {
      if (isLifeEventRecordSourceFrozenError(created))
        return new ConflictError("life event writes are frozen", "record_source_frozen", {
          cause: created,
        })
      return new UnexpectedError("failed to create life event", { cause: created })
    }

    return created
  }
}
