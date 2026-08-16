import type { Session } from "@/contexts/company/domain/iam/session"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { MeetingMinutes } from "@/contexts/meeting/domain/meeting-minutes.entity"
import type { Context } from "@/env"
import { MeetingMinutesRepository } from "@/contexts/meeting/infrastructure/meeting-minutes-repository"

export type Command = {
  session: Session
  minutesId: number
  heldOn: string
  title: string
  attendees: string | null
  bodyMd: string
}

/**
 * 議事録の開催日・表題・出席者・本文を更新する。作成者本人 or meeting:manage のみ。
 */
export class UpdateMeetingMinutes {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<MeetingMinutes | ApplicationError> {
    const minutesRepository = new MeetingMinutesRepository(this.c)

    const current = await minutesRepository.findById(command.minutesId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find meeting minutes", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("meeting minutes not found", "meeting_minutes_not_found")
    }

    const isAuthor = current.authorEmployeeId === command.session.employeeId

    if (isAuthor === false && command.session.hasPermission("meeting:manage") === false) {
      return new ForbiddenError("not the author", "not_author")
    }

    const updated = await minutesRepository.update(
      current.withContent({
        heldOn: command.heldOn,
        title: command.title,
        attendees: command.attendees,
        bodyMd: command.bodyMd,
      }),
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update meeting minutes", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("meeting minutes not found", "meeting_minutes_not_found")
    }

    return updated
  }
}
