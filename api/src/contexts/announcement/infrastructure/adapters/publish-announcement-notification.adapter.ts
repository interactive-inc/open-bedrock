import type { Announcement } from "@/contexts/announcement/domain/entities/announcement.entity"
import { CompanyAccountEmployeeLinksReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-account-employee-links-read.adapter"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { Context } from "@/env"
import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"
import { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import { PublishSystemNotification } from "@system/application/notifications/publish-system-notification"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"

export class PublishAnnouncementNotificationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async publishToAllEmployees(
    announcement: Announcement,
    createdAtValue: string,
  ): Promise<null | Error> {
    try {
      const links = await new CompanyAccountEmployeeLinksReadAdapter(this.c).findMany({})
      if (links instanceof Error) return links
      const employees = await new CompanyEmployeeDirectoryReadAdapter({
        env: this.c.env,
      }).findForAccountIds(links.map((link) => zAccountId.parse(link.accountId)))
      if (employees instanceof Error) return employees
      const recipients = employees.filter(
        (entry) =>
          entry.employee.employment?.status === "ACTIVE" ||
          entry.employee.employment?.status === "ON_LEAVE",
      )

      if (recipients.length === 0) return null

      const createdAt = new Date(createdAtValue)
      const message = NotificationMessageEntity.create({
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

      const deliveries = NotificationDeliveryBatchValue.create(
        recipients.map((recipient) =>
          NotificationDeliveryEntity.create({
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
