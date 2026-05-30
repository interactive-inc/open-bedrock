import type { Context } from "@/env"
import { NotificationRepository } from "@/infrastructure/notification/notification-repository"

export type Command = {
  recipientEmployeeId: number
}

/**
 * 本人宛ての未読通知をすべて既読にし、更新件数を返す。
 */
export class MarkAllNotificationsRead {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<number | Error> {
    const repository = new NotificationRepository(this.c)

    return await repository.markAllRead(command.recipientEmployeeId)
  }
}
