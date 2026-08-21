import type { Session } from "@/contexts/company/domain/iam/session"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { Meeting } from "@/contexts/meeting/domain/meeting.entity"
import type { Context } from "@/env"
import { MeetingRepository } from "@/contexts/meeting/infrastructure/meeting.repository"

export type Command = {
  session: Session
  code: string
  name: string
  cadence: string | null
  description: string | null
  createdAt: string
}

/**
 * 権限を確認し、会議体を新規登録する。code は全社で一意。
 */
export class CreateMeeting {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Meeting | ApplicationError> {
    const meetingRepository = new MeetingRepository(this.c)

    if (command.session.hasPermission("meeting:manage") === false) {
      return new ForbiddenError("cannot manage meetings", "forbidden")
    }

    const existing = await meetingRepository.findByCode(command.code)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find meeting", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("meeting code already exists", "meeting_code_conflict")
    }

    const meeting = Meeting.create({
      code: command.code,
      name: command.name,
      cadence: command.cadence,
      description: command.description,
      createdAt: command.createdAt,
    })

    const created = await meetingRepository.create(meeting)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create meeting", { cause: created })
    }

    return created
  }
}
