import { Notification } from "@system/domain/notifications/notification.entity"
import type { Context } from "@/env"
import { notifications } from "@/contexts/system/infrastructure/schema/system"
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

      return row === undefined ? null : Notification.restore(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load notification")
    }
  }

  async create(notification: Notification): Promise<Notification | Error> {
    try {
      const rows = await this.c.var.database
        .insert(notifications)
        .values({
          recipientAccountId: notification.recipientAccountId,
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
        : Notification.restore(row)
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

      return row === undefined ? null : Notification.restore(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to mark notification read")
    }
  }

  async markAllRead(recipientAccountId: number): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .update(notifications)
        .set({ isRead: 1 })
        .where(
          and(
            eq(notifications.recipientAccountId, recipientAccountId),
            eq(notifications.isRead, 0),
          ),
        )
        .returning({ id: notifications.id })

      return rows.length
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to mark notifications read")
    }
  }

  /** 通知を1件削除する。所有権ガード付き。 */
  async delete(notificationId: number, recipientAccountId: number): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(notifications)
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.recipientAccountId, recipientAccountId),
          ),
        )
        .returning({ id: notifications.id })

      return rows.length > 0 ? true : null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete notification")
    }
  }
}
