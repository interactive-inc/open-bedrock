import type { Context } from "@/env"
import { NotificationRepository } from "@system/infrastructure/notifications/notification-repository"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  recipientAccountId: number
}

/** Account 本人宛ての未読通知をすべて既読にし、更新件数を返す。 */
export class MarkAllNotificationsRead {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<number | ApplicationError> {
    const repository = new NotificationRepository(this.c)

    const updated = await repository.markAllRead(command.recipientAccountId)

    if (updated instanceof Error) {
      return new UnexpectedError("failed to mark notifications read", { cause: updated })
    }

    return updated
  }
}
