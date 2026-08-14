import type { CompanyNotificationKind } from "@/contexts/company/domain/company/notifications/notification-kind"
import { Notification } from "@/contexts/system/domain/notifications/notification.entity"
import type { Context } from "@/env"
import { AccountEmployeeLinkRepository } from "@/contexts/company/infrastructure/employee/account-employee-link-repository"
import { NotificationRepository } from "@/contexts/system/infrastructure/notifications/notification-repository"

export type EmployeeNotification = Readonly<{
  recipientEmployeeId: number
  kind: CompanyNotificationKind
  title: string
  body: string | null
  sourceDomain: string
  sourceId: number | null
  createdAt: string
}>

/** Company の Employee 宛て要求を System の Account 宛て通知へ変換する。 */
export class EmployeeNotificationGateway {
  constructor(private readonly c: Context) {}

  async create(props: EmployeeNotification): Promise<Notification | Error> {
    const linkedAccount = await new AccountEmployeeLinkRepository(
      this.c,
    ).findLinkedAccountByEmployeeId(props.recipientEmployeeId)

    if (linkedAccount instanceof Error) {
      return linkedAccount
    }

    if (linkedAccount === null) {
      return new Error("notification recipient has no linked account")
    }

    return await new NotificationRepository(this.c).create(
      Notification.create({
        recipientAccountId: linkedAccount.accountId,
        kind: props.kind,
        title: props.title,
        body: props.body,
        sourceDomain: props.sourceDomain,
        sourceId: props.sourceId,
        createdAt: props.createdAt,
      }),
    )
  }
}
