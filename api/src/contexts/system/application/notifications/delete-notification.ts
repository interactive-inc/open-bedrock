import type { SystemDatabaseContext } from "@system/infrastructure/configuration/system-context"
import { NotificationRepository } from "@system/infrastructure/notifications/notification-repository"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  notificationId: number
  viewerAccountId: number
}

export type Deleted = { reason: "deleted" }

/** Account 本人宛ての通知を削除する。所有権ガードは DB レベルで行う。 */
export class DeleteNotification {
  constructor(private readonly c: SystemDatabaseContext) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
    const repository = new NotificationRepository(this.c)

    const deleted = await repository.delete(command.notificationId, command.viewerAccountId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete notification", { cause: deleted })
    }

    if (deleted === null) {
      return new NotFoundError("notification not found", "not_found")
    }

    return { reason: "deleted" }
  }
}
