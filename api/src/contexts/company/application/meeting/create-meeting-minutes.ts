import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { MeetingMinutes } from "@/contexts/company/domain/meeting/meeting-minutes.entity"
import type { Context } from "@/env"
import { MeetingMinutesRepository } from "@/contexts/company/infrastructure/meeting/meeting-minutes-repository"
import { MeetingRepository } from "@/contexts/company/infrastructure/meeting/meeting-repository"

export type Command = {
  meetingCode: string
  heldOn: string
  title: string
  attendees: string | null
  bodyMd: string
  authorEmployeeId: number
  createdAt: string
}

/**
 * 議事録を記録する。閲覧と同様、書けるのは全認証者(記録文化を阻害しない)。
 * 会議体 code から meeting_id を解決し、存在しなければ NotFound。
 */
export class CreateMeetingMinutes {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<MeetingMinutes | ApplicationError> {
    const meetingRepository = new MeetingRepository(this.c)

    const meeting = await meetingRepository.findByCode(command.meetingCode)

    if (meeting instanceof Error) {
      return new UnexpectedError("failed to find meeting", { cause: meeting })
    }

    if (meeting === null || meeting.id === null) {
      return new NotFoundError("meeting not found", "meeting_not_found")
    }

    const minutes = MeetingMinutes.create({
      meetingId: meeting.id,
      heldOn: command.heldOn,
      title: command.title,
      attendees: command.attendees,
      bodyMd: command.bodyMd,
      authorEmployeeId: command.authorEmployeeId,
      createdAt: command.createdAt,
    })

    const minutesRepository = new MeetingMinutesRepository(this.c)

    const created = await minutesRepository.create(minutes)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create meeting minutes", { cause: created })
    }

    return created
  }
}
