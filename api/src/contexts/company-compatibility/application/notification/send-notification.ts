import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import type { CompanyNotificationKind } from "@/contexts/company-compatibility/domain/company/notifications/notification-kind"
import type { Notification } from "@/contexts/system-compatibility/domain/notifications/legacy-notification.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/contexts/company-compatibility/infrastructure/employee/employee-repository"
import { EmployeeNotificationGateway } from "@/contexts/company-compatibility/infrastructure/company/notifications/employee-notification.gateway"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: Session
  recipientEmployeeCode: string
  kind: CompanyNotificationKind
  title: string
  body: string | null
  sourceDomain: string
  sourceId: number | null
  createdAt: string
}

export type SentNotification = Readonly<{
  notification: Notification
  recipientEmployeeId: number
}>

/**
 * 権限を持つ役割が、相手の社員コードを解決して通知を作成する。
 */
export class SendNotification {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<SentNotification | ApplicationError> {
    const employeeRepository = new EmployeeRepository(this.c)

    if (command.session.hasPermission("notification:send") === false) {
      return new ForbiddenError("cannot send notification", "notification_forbidden")
    }

    const recipient = await employeeRepository.findByCode(command.recipientEmployeeCode)

    if (recipient instanceof Error) {
      return new UnexpectedError("failed to find recipient", { cause: recipient })
    }

    if (recipient === null) {
      return new NotFoundError("recipient not found", "recipient_not_found")
    }

    const created = await new EmployeeNotificationGateway(this.c).create({
      recipientEmployeeId: recipient.id,
      kind: command.kind,
      title: command.title,
      body: command.body,
      sourceDomain: command.sourceDomain,
      sourceId: command.sourceId,
      createdAt: command.createdAt,
    })

    if (created instanceof Error) {
      return new UnexpectedError("failed to create notification", { cause: created })
    }

    return { notification: created, recipientEmployeeId: recipient.id }
  }
}
