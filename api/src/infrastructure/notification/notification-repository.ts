import { Notification } from "@/domain/notification/notification"
import type { Context } from "@/env"
import { notifications } from "@/schema"
import { and, eq } from "drizzle-orm"

export class NotificationRepository {
  constructor(private readonly c: Context) {}

  async findById(notificationId: number): Promise<Notification | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(notifications)
        .where(eq(notifications.id, notificationId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Notification.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load notification")
    }
  }

  async create(notification: Notification): Promise<Notification | Error> {
    try {
      const rows = await this.c.var.database
        .insert(notifications)
        .values({
          recipientEmployeeId: notification.recipientEmployeeId,
          sourceDomain: notification.sourceDomain,
          sourceId: notification.sourceId,
          kind: notification.kind,
          title: notification.title,
          body: notification.body,
          isRead: notification.isRead ? 1 : 0,
          createdAt: notification.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert notification")
        : Notification.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert notification")
    }
  }

  async update(notification: Notification): Promise<Notification | null | Error> {
    try {
      if (notification.id === null) {
        return new Error("cannot update unsaved notification")
      }

      const rows = await this.c.var.database
        .update(notifications)
        .set({ isRead: notification.isRead ? 1 : 0 })
        .where(eq(notifications.id, notification.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Notification.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to mark notification read")
    }
  }

  async markAllRead(recipientEmployeeId: number): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .update(notifications)
        .set({ isRead: 1 })
        .where(
          and(
            eq(notifications.recipientEmployeeId, recipientEmployeeId),
            eq(notifications.isRead, 0),
          ),
        )
        .returning({ id: notifications.id })

      return rows.length
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to mark notifications read")
    }
  }
}
