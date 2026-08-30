import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Meeting } from "@/contexts/meeting/domain/entities/meeting.entity"
import type { Context } from "@/env"
import { MeetingRepository } from "@/contexts/meeting/infrastructure/repositories/meeting.repository"

export type Command = {
  session: CompanySessionValue
  code: string
  name: string
  cadence: string | null
  description: string | null
}

/**
 * 権限を確認し、会議体の名称・頻度・説明を更新する。
 */
export class UpdateMeeting {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

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
