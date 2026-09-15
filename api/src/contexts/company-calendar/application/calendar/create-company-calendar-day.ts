import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { CompanyCalendarDay } from "@/contexts/company-calendar/domain/entities/company-calendar-day.entity"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { CalendarDayKind } from "@/contexts/company-calendar/domain/definitions/calendar-day-kind.definition"
import type { Context } from "@/env"
import { CompanyCalendarDayRepository } from "@/contexts/company-calendar/infrastructure/repositories/calendar/company-calendar-day.repository"
import { UniqueConstraintError } from "@/lib/d1/errors"
import { isCompanyCalendarDayRecordSourceFrozenError } from "@/contexts/company-calendar/infrastructure/repositories/lib/is-company-calendar-record-source-frozen-error"

export type Command = {
  session: CompanySessionValue
  calendarDate: string
  kind: CalendarDayKind
  name: string | null
  createdAt: string
}

/**
 * 権限と同一日の重複を確認し、会社カレンダーに 1 日を記録する。
 */
export class CreateCompanyCalendarDay {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<CompanyCalendarDay | ApplicationError> {
    if (command.session.hasPermission("calendar:manage") === false) {
      return new ForbiddenError("cannot manage calendar", "forbidden")
    }

    const repository = new CompanyCalendarDayRepository(this.c)

    const day = CompanyCalendarDay.create({
      calendarDate: command.calendarDate,
      kind: command.kind,
      name: command.name,
      createdAt: command.createdAt,
    })

    const created = await repository.create(day)

    if (created instanceof UniqueConstraintError) {
      return new ConflictError("calendar date already exists", "calendar_date_conflict")
    }

    if (created instanceof Error) {
      if (isCompanyCalendarDayRecordSourceFrozenError(created)) {
        return new ConflictError("company calendar writes are frozen", "record_source_frozen", {
          cause: created,
        })
      }
      return new UnexpectedError("failed to create calendar day", { cause: created })
    }

    return created
  }
}
