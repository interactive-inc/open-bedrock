import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { Announcement } from "@/contexts/announcement/domain/entities/announcement.entity"
import type { Context } from "@/env"
import { AnnouncementRepository } from "@/contexts/announcement/infrastructure/repositories/announcement.repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: CompanySessionValue
  announcementId: number
  title: string
  bodyMd: string
}

/**
 * 権限を確認し、社内アナウンスの表題・本文を更新する。
 */
export class UpdateAnnouncement {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

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

    const updated = current.withContent({
      title: command.title,
      bodyMd: command.bodyMd,
    })

    const result = await announcementRepository.update(updated)

    if (result instanceof Error) {
      return new UnexpectedError("failed to update announcement", { cause: result })
    }

    if (result === null) {
      return new NotFoundError("announcement not found", "announcement_not_found")
    }

    return result
  }
}
