import type { Session } from "@/contexts/company/domain/iam/session"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CompanyCalendarDayRepository } from "@/contexts/company-calendar/infrastructure/calendar/company-calendar-day.repository"

export type Command = {
  session: Session
  id: number
}

/**
 * 権限と存在を確認し、会社カレンダーから 1 日を削除する。
 */
export class DeleteCompanyCalendarDay {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<null | ApplicationError> {
    if (command.session.hasPermission("calendar:manage") === false) {
      return new ForbiddenError("cannot manage calendar", "forbidden")
    }

    const repository = new CompanyCalendarDayRepository(this.c)

    const existing = await repository.findById(command.id)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find calendar day", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("calendar day not found", "calendar_day_not_found")
    }

    const deleted = await repository.delete(command.id)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete calendar day", { cause: deleted })
    }

    return null
  }
}
