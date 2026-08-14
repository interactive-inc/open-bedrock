import type { Session } from "@/contexts/company/domain/iam/session"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Meeting } from "@/contexts/company/domain/meeting/meeting.entity"
import type { Context } from "@/env"
import { MeetingRepository } from "@/contexts/company/infrastructure/meeting/meeting-repository"

export type Command = {
  session: Session
  code: string
  name: string
  cadence: string | null
  description: string | null
}

/**
 * 権限を確認し、会議体の名称・頻度・説明を更新する。
 */
export class UpdateMeeting {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Meeting | ApplicationError> {
    const meetingRepository = new MeetingRepository(this.c)

    if (command.session.hasPermission("meeting:manage") === false) {
      return new ForbiddenError("cannot manage meetings", "forbidden")
    }

    const current = await meetingRepository.findByCode(command.code)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find meeting", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("meeting not found", "meeting_not_found")
    }

    const updated = await meetingRepository.update(
      current.withContent({
        name: command.name,
        cadence: command.cadence,
        description: command.description,
      }),
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update meeting", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("meeting not found", "meeting_not_found")
    }

    return updated
  }
}
