import type { SystemDatabaseContext } from "@system/infrastructure/configuration/system-context"
import { NotificationRepository } from "@/api/legacy-system/adapters/notifications/notification-repository"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  recipientAccountId: number
}

/** Account 本人宛ての未読通知をすべて既読にし、更新件数を返す。 */
export class MarkAllNotificationsRead {
  constructor(private readonly c: SystemDatabaseContext) {}

  async run(command: Command): Promise<number | ApplicationError> {
    const repository = new NotificationRepository(this.c)

    const updated = await repository.markAllRead(command.recipientAccountId)

    if (updated instanceof Error) {
      return new UnexpectedError("failed to mark notifications read", { cause: updated })
    }

    return updated
  }
}
