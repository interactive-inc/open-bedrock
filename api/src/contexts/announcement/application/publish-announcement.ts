import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import type { Announcement } from "@/contexts/announcement/domain/announcement.entity"
import type { Context } from "@/env"
import { AnnouncementRepository } from "@/contexts/announcement/infrastructure/announcement-repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import {
  accountEmployeeLinks,
  employees,
} from "@/contexts/company-compatibility/infrastructure/schema/employee"
import { notifications } from "@/contexts/system-compatibility/infrastructure/schema/system"
import { eq } from "drizzle-orm"

export type Command = {
  session: Session
  announcementId: number
  publishedOn: string
  createdAt: string
}

/**
 * 権限を確認して社内アナウンスを公開し、全 active 従業員へ通知を配信する。
 */
export class PublishAnnouncement {
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

    const published = current.publish(command.publishedOn)

    const result = await announcementRepository.update(published)

    if (result instanceof Error) {
      return new UnexpectedError("failed to publish announcement", { cause: result })
    }

    if (result === null) {
      return new NotFoundError("announcement not found", "announcement_not_found")
    }

    const notified = await this.notifyAllEmployees(result)

    if (notified instanceof Error) {
      return new UnexpectedError("failed to notify announcement", { cause: notified })
    }

    return result
  }

  /** 公開されたアナウンスを全 active 従業員へ 1 通ずつ配信する。 */
  private async notifyAllEmployees(announcement: Announcement): Promise<null | Error> {
    try {
      const recipients = await this.c.var.database
        .select({ accountId: accountEmployeeLinks.accountId })
        .from(employees)
        .innerJoin(accountEmployeeLinks, eq(accountEmployeeLinks.employeeId, employees.id))
        .where(eq(employees.status, "active"))

      if (recipients.length === 0) {
        return null
      }

      await this.c.var.database.insert(notifications).values(
        recipients.map((recipient) => ({
          recipientAccountId: recipient.accountId,
          sourceDomain: "announcement",
          sourceId: announcement.id,
          kind: "announcement",
          title: announcement.title,
          body: null,
          isRead: 0,
          createdAt: announcement.createdAt,
        })),
      )

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to notify announcement")
    }
  }
}
