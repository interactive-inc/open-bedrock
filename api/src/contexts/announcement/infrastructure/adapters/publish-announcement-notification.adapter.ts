import type { Announcement } from "@/contexts/announcement/domain/entities/announcement.entity"
import { accountEmployeeLinks } from "@/contexts/company/infrastructure/schema/employee"
import { employments } from "@/contexts/company/infrastructure/schema/employment"
import type { Context } from "@/env"
import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"
import { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import { PublishSystemNotification } from "@system/application/notifications/publish-system-notification"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"
import { and, eq, inArray, isNull } from "drizzle-orm"

export class PublishAnnouncementNotificationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async publishToAllEmployees(
    announcement: Announcement,
    createdAtValue: string,
  ): Promise<null | Error> {
    try {
      const recipients = await this.c.var.database
        .select({ accountId: accountEmployeeLinks.accountId })
        .from(accountEmployeeLinks)
        .innerJoin(employments, eq(employments.employeeId, accountEmployeeLinks.employeeId))
        .where(
          and(
            inArray(employments.status, ["ACTIVE", "ON_LEAVE"]),
            isNull(employments.terminationDate),
          ),
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
