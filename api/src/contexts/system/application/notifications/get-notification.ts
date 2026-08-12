import type { Notification } from "@system/domain/notifications/notification.entity"
import type { Context } from "@/env"
import { NotificationRepository } from "@system/infrastructure/notifications/notification-repository"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  notificationId: number
  viewerAccountId: number
}

/** Account 本人宛ての通知を1件取得する。他の Account 宛ての閲覧を拒否する。 */
export class GetNotification {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Notification | ApplicationError> {
    const repository = new NotificationRepository(this.c)

    const notification = await repository.findById(command.notificationId)

    if (notification instanceof Error) {
      return new UnexpectedError("failed to find notification", { cause: notification })
    }

    if (notification === null) {
      return new NotFoundError("notification not found", "notification_not_found")
    }

    if (notification.recipientAccountId !== command.viewerAccountId) {
      return new NotFoundError("notification not found", "notification_forbidden")
    }

    return notification
  }
}
