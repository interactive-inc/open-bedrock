import type { Notification } from "@/domain/notification/notification.entity"
import type { Context } from "@/env"
import { NotificationRepository } from "@/infrastructure/notification/notification-repository"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  notificationId: number
  viewerEmployeeId: number
}

/**
 * 本人宛ての通知を1件取得する。他人宛ての閲覧を拒否する。
 */
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

    if (notification.recipientEmployeeId !== command.viewerEmployeeId) {
      // 他人宛ては存在を伏せるため not found 扱いにして列挙を防ぐ。
      return new NotFoundError("notification not found", "notification_forbidden")
    }

    return notification
  }
}
