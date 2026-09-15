import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { Announcement } from "@/contexts/announcement/domain/entities/announcement.entity"
import type { Context } from "@/env"
import { AnnouncementRepository } from "@/contexts/announcement/infrastructure/repositories/announcement.repository"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import { isAnnouncementRecordSourceFrozenError } from "@/contexts/announcement/infrastructure/repositories/lib/is-announcement-record-source-frozen-error"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: CompanySessionValue
  title: string
  bodyMd: string
  authorEmployeeId: EmployeeId
  createdAt: string
}

/**
 * 権限を確認し、社内アナウンスを draft 状態で新規作成する。
 */
export class CreateAnnouncement {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

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
      if (isAnnouncementRecordSourceFrozenError(created))
        return new ConflictError("announcement writes are frozen", "record_source_frozen", {
          cause: created,
        })
      return new UnexpectedError("failed to create announcement", { cause: created })
    }

    return created
  }
}
