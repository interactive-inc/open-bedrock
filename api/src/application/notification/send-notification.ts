import type { NotificationKind } from "@/domain/notification/notification.entity"
import { Notification } from "@/domain/notification/notification.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { NotificationRepository } from "@/infrastructure/notification/notification-repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { canSendNotification } from "@/lib/notification/can-send-notification"

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

/**
 * 権限を持つ役割が、相手の社員コードを解決して通知を作成する。
 */
export class SendNotification {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Notification | ApplicationError> {
    const notificationRepository = new NotificationRepository(this.c)

    const employeeRepository = new EmployeeRepository(this.c)

    if (canSendNotification(command.viewerRole) === false) {
      return new ForbiddenError("cannot send notification", "notification_forbidden")
    }

    const recipient = await employeeRepository.findByCode(command.recipientEmployeeCode)

    if (recipient instanceof Error) {
      return new UnexpectedError("failed to find recipient", { cause: recipient })
    }

    if (recipient === null) {
      return new NotFoundError("recipient not found", "recipient_not_found")
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
      return new UnexpectedError("failed to create notification", { cause: created })
    }

    return created
  }
}
