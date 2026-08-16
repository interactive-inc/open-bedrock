import type { CompanyNotificationKind } from "@/contexts/company/domain/company/notifications/notification-kind"
import { Notification } from "@/api/legacy-system/model/notifications/legacy-notification.entity"
import type { Context } from "@/env"
import { ResolveAccountEmployeeLink } from "@/contexts/company/application/workforce/resolve-account-employee-link"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { AccountEmployeeLinkReadRepository } from "@/contexts/company/infrastructure/workforce/account-employee-link-read.repository"
import { NotificationRepository } from "@/api/legacy-system/adapters/notifications/notification-repository"

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
    const resolved = await new ResolveAccountEmployeeLink(
      new AccountEmployeeLinkReadRepository(this.c),
    ).execute({
      kind: "by_employee",
      employeeId: toWorkforceEmployeeId(props.recipientEmployeeId),
    })
    if (resolved.kind !== "found") {
      return new Error(`notification recipient account link is ${resolved.kind}`, {
        cause: resolved.kind === "unavailable" ? resolved.cause : undefined,
      })
    }

    const legacyAccountId = Number(resolved.link.accountId)
    if (
      !Number.isSafeInteger(legacyAccountId) ||
      legacyAccountId < 1 ||
      String(legacyAccountId) !== resolved.link.accountId
    ) {
      return new Error("notification recipient account is not legacy-compatible")
    }

    return await new NotificationRepository(this.c).create(
      Notification.create({
        recipientAccountId: legacyAccountId,
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
