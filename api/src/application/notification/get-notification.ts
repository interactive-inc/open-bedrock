import type { Notification } from "@/domain/notification/notification"
import type { Context } from "@/env"
import { NotificationRepository } from "@/infrastructure/notification/notification-repository"

export type Command = {
  notificationId: number
  viewerEmployeeId: number
}

export type NotificationNotFound = { reason: "notification_not_found" }

export type NotificationForbidden = { reason: "notification_forbidden" }

/**
 * 本人宛ての通知を1件取得する。他人宛ての閲覧を拒否する。
 */
export class GetNotification {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Notification | NotificationNotFound | NotificationForbidden | Error> {
    const repository = new NotificationRepository(this.c)

    const notification = await repository.findById(command.notificationId)

    if (notification instanceof Error) {
      return notification
    }

    if (notification === null) {
      return { reason: "notification_not_found" }
    }

    if (notification.recipientEmployeeId !== command.viewerEmployeeId) {
      return { reason: "notification_forbidden" }
    }

    return notification
  }
}
