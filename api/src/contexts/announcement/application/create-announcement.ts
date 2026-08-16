import type { Session } from "@/contexts/company/domain/iam/session"
import { Announcement } from "@/contexts/announcement/domain/announcement.entity"
import type { Context } from "@/env"
import { AnnouncementRepository } from "@/contexts/announcement/infrastructure/announcement-repository"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: Session
  title: string
  bodyMd: string
  authorEmployeeId: number
  createdAt: string
}

/**
 * 権限を確認し、社内アナウンスを draft 状態で新規作成する。
 */
export class CreateAnnouncement {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Announcement | ApplicationError> {
    const announcementRepository = new AnnouncementRepository(this.c)

    if (command.session.hasPermission("announcement:manage") === false) {
      return new ForbiddenError("cannot manage announcements", "forbidden")
    }

    const announcement = Announcement.create({
      title: command.title,
      bodyMd: command.bodyMd,
      authorEmployeeId: command.authorEmployeeId,
      createdAt: command.createdAt,
    })

    const created = await announcementRepository.create(announcement)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create announcement", { cause: created })
    }

    return created
  }
}
