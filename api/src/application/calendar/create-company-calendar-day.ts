import { CompanyCalendarDay } from "@/domain/calendar/company-calendar-day.entity"
import { canManageCalendar } from "@/lib/calendar/can-manage-calendar"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { CalendarDayKind } from "@/lib/schemas"
import type { Context, SessionPayload } from "@/env"
import { CompanyCalendarDayRepository } from "@/infrastructure/calendar/company-calendar-day-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"

export type Command = {
  session: SessionPayload
  calendarDate: string
  kind: CalendarDayKind
  name: string | null
  createdAt: string
}

/**
 * 権限と同一日の重複を確認し、会社カレンダーに 1 日を記録する。
 */
export class CreateCompanyCalendarDay {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<CompanyCalendarDay | ApplicationError> {
    if (canManageCalendar(command.session) === false) {
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
      return new UnexpectedError("failed to create calendar day", { cause: created })
    }

    return created
  }
}
