import { canSendNotification } from "@/lib/notification/can-send-notification"
import type { NotificationKind } from "@/domain/notification/notification.entity"
import { Notification } from "@/domain/notification/notification.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { NotificationRepository } from "@/infrastructure/notification/notification-repository"

export type Command = {
  viewerRole: string
  recipientEmployeeCode: string
  kind: NotificationKind
  title: string
  body: string | null
  sourceDomain: string
  sourceId: number | null
  createdAt: string
}

export type NotificationForbidden = { reason: "notification_forbidden" }

export type RecipientNotFound = { reason: "recipient_not_found" }

/**
 * 権限を持つ役割が、相手の社員コードを解決して通知を作成する。
 */
export class SendNotification {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Notification | NotificationForbidden | RecipientNotFound | Error> {
    const notificationRepository = new NotificationRepository(this.c)

    const employeeRepository = new EmployeeRepository(this.c)

    if (canSendNotification(command.viewerRole) === false) {
      return { reason: "notification_forbidden" }
    }

    const recipient = await employeeRepository.findByCode(command.recipientEmployeeCode)

    if (recipient instanceof Error) {
      return recipient
    }

    if (recipient === null) {
      return { reason: "recipient_not_found" }
    }

    const notification = Notification.create({
      recipientEmployeeId: recipient.id,
      kind: command.kind,
      title: command.title,
      body: command.body,
      sourceDomain: command.sourceDomain,
      sourceId: command.sourceId,
      createdAt: command.createdAt,
    })

    const created = await notificationRepository.create(notification)

    if (created instanceof Error) {
      return created
    }

    return created
  }
}
