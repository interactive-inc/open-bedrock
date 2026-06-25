import type { Context } from "@/env"
import { NotificationRepository } from "@/infrastructure/notification/notification-repository"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  notificationId: number
  viewerEmployeeId: number
}

export type Deleted = { reason: "deleted" }

/**
 * 本人宛ての通知を削除する。所有権ガードは DB レベルで行う。
 */
export class DeleteNotification {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
    const repository = new NotificationRepository(this.c)

    const deleted = await repository.delete(command.notificationId, command.viewerEmployeeId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete notification", { cause: deleted })
    }

    if (deleted === null) {
      return new NotFoundError("notification not found", "not_found")
    }

    return { reason: "deleted" }
  }
}
