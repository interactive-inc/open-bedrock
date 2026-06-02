import type { Context } from "@/env"
import { NotificationRepository } from "@/infrastructure/notification/notification-repository"

export type Command = {
  notificationId: number
  viewerEmployeeId: number
}

export type NotificationNotFound = { reason: "notification_not_found" }

export type NotificationForbidden = { reason: "notification_forbidden" }

export type Deleted = { reason: "deleted" }

/**
 * 本人宛ての通知を削除する。他人宛ての削除を拒否する。
 */
export class DeleteNotification {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Deleted | NotificationNotFound | NotificationForbidden | Error> {
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

    const deleted = await repository.delete(command.notificationId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "deleted" }
  }
}
