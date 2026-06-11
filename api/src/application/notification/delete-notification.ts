import type { Context } from "@/env"
import { NotificationRepository } from "@/infrastructure/notification/notification-repository"

export type Command = {
  notificationId: number
  viewerEmployeeId: number
}

export type NotificationNotFound = { reason: "not_found" }

export type Deleted = { reason: "deleted" }

/**
 * 本人宛ての通知を削除する。所有権ガードは DB レベルで行う。
 */
export class DeleteNotification {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Deleted | NotificationNotFound | Error> {
    const repository = new NotificationRepository(this.c)

    const deleted = await repository.delete(
      command.notificationId,
      command.viewerEmployeeId,
    )

    if (deleted instanceof Error) {
      return deleted
    }

    if (deleted === null) {
      return { reason: "not_found" }
    }

    return { reason: "deleted" }
  }
}
