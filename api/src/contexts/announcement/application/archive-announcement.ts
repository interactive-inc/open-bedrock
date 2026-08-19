import type { Session } from "@/contexts/company/domain/iam/session"
import type { Announcement } from "@/contexts/announcement/domain/announcement.entity"
import type { Context } from "@/env"
import { AnnouncementRepository } from "@/contexts/announcement/infrastructure/announcement-repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: Session
  announcementId: number
}

/**
 * 権限を確認し、社内アナウンスをアーカイブする。物理削除はしない。
 */
export class ArchiveAnnouncement {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Announcement | ApplicationError> {
    const announcementRepository = new AnnouncementRepository(this.c)

    if (command.session.hasPermission("announcement:manage") === false) {
      return new ForbiddenError("cannot manage announcements", "forbidden")
    }

    const current = await announcementRepository.findById(command.announcementId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find announcement", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("announcement not found", "announcement_not_found")
    }

    const result = await announcementRepository.update(current.archive())

    if (result instanceof Error) {
      return new UnexpectedError("failed to archive announcement", { cause: result })
    }

    if (result === null) {
      return new NotFoundError("announcement not found", "announcement_not_found")
    }

    return result
  }
}
