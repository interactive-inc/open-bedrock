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
import { eq } from "drizzle-orm"
import { PublishSystemNotification } from "@system/application/notifications/publish-system-notification"
import { NotificationDeliveryBatch } from "@system/domain/notifications/notification-delivery-batch"
import { NotificationDelivery } from "@system/domain/notifications/notification-delivery.entity"
import { NotificationMessage } from "@system/domain/notifications/notification-message.entity"
import { SystemNotificationRepository } from "@system/infrastructure/notifications/system-notification-repository"

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

    const notified = await this.notifyAllEmployees(result, command.createdAt)

    if (notified instanceof Error) {
      return new UnexpectedError("failed to notify announcement", { cause: notified })
    }

    return result
  }

  /** 公開されたアナウンスを全 active 従業員へ 1 通ずつ配信する。 */
  private async notifyAllEmployees(
    announcement: Announcement,
    createdAtValue: string,
  ): Promise<null | Error> {
    try {
      const recipients = await this.c.var.database
        .select({ accountId: accountEmployeeLinks.accountId })
        .from(employees)
        .innerJoin(accountEmployeeLinks, eq(accountEmployeeLinks.employeeId, employees.id))
        .where(eq(employees.status, "active"))

      if (recipients.length === 0) {
        return null
      }

      const createdAt = new Date(createdAtValue)
      const message = NotificationMessage.create({
        id: crypto.randomUUID(),
        kind: "company:announcement",
        title: announcement.title,
        body: null,
        source: {
          type: "company:notification.source",
          id: JSON.stringify({ domain: "announcement", id: announcement.id }),
        },
        createdAt,
      })
      if (message instanceof Error) return message

      const deliveries = NotificationDeliveryBatch.create(
        recipients.map((recipient) =>
          NotificationDelivery.create({
            id: crypto.randomUUID(),
            messageId: message.id,
            recipientAccountId: String(recipient.accountId),
            deliveredAt: createdAt,
            readAt: null,
          }),
        ),
      )
      if (deliveries instanceof Error) return deliveries

      const published = await new PublishSystemNotification({
        notificationRepository: new SystemNotificationRepository({
          context: { env: { DB: this.c.env.DB } },
        }),
      }).execute({ message, deliveries })
      if (published instanceof Error) return published
      if (published.kind === "rejected") {
        return new Error(`announcement notification rejected: ${published.reason}`)
      }

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to notify announcement")
    }
  }
}
