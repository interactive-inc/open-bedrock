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
 * 本人宛ての通知を既読にする。他人宛ては拒否する。
 */
export class MarkNotificationRead {
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

    const updated = await repository.update(notification.markRead())

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return { reason: "notification_not_found" }
    }

    return updated
  }
}
