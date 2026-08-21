import type { CompanyNotificationKind } from "@/api/http/notifications/notification-kind.definition"
import type { Context } from "@/env"
import { ResolveAccountEmployeeLink } from "@/contexts/company/infrastructure/workforce/resolve-account-employee-link.repository"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import { AccountEmployeeLinkReadRepository } from "@/contexts/company/infrastructure/workforce/account-employee-link-read.repository"
import { PublishSystemNotification } from "@system/application/notifications/publish-system-notification"
import { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"
import { SystemNotificationRepository } from "@system/infrastructure/notifications/system-notification.repository"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"

export type EmployeeNotification = Readonly<{
  recipientEmployeeId: number
  kind: CompanyNotificationKind
  title: string
  body: string | null
  sourceDomain: string
  sourceId: number | null
  createdAt: string
}>

export type PublishedEmployeeNotification = Readonly<{
  id: number
  recipientAccountId: AccountId
  sourceDomain: string
  sourceId: number | null
  kind: CompanyNotificationKind
  title: string
  body: string | null
  isRead: false
  createdAt: string
}>

/** Company の Employee 宛て要求を System の Account 宛て通知へ変換する。 */
export class EmployeeNotificationGateway {
  constructor(private readonly c: Context) {}

  async create(props: EmployeeNotification): Promise<PublishedEmployeeNotification | Error> {
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

    const recipientAccountId = zAccountId.safeParse(resolved.link.accountId)
    if (!recipientAccountId.success) {
      return new Error("notification recipient account ID is invalid", {
        cause: recipientAccountId.error,
      })
    }

    const createdAt = new Date(props.createdAt)
    if (!Number.isSafeInteger(createdAt.getTime())) {
      return new Error("notification creation time is invalid")
    }

    const words = crypto.getRandomValues(new Uint32Array(2))
    const notificationId = ((words[0] ?? 0) & 0x000f_ffff) * 0x1_0000_0000 + (words[1] ?? 0) || 1
    const canonicalId = String(notificationId)
    const message = NotificationMessageEntity.create({
      id: canonicalId,
      kind: `company:${props.kind}`,
      title: props.title,
      body: props.body,
      source: {
        type: "company:notification.source",
        id: JSON.stringify({ domain: props.sourceDomain, id: props.sourceId }),
      },
      createdAt,
    })
    if (message instanceof Error) return message

    const delivery = NotificationDeliveryEntity.create({
      id: canonicalId,
      messageId: message.id,
      recipientAccountId: recipientAccountId.data,
      deliveredAt: createdAt,
      readAt: null,
    })
    if (delivery instanceof Error) return delivery

    const deliveries = NotificationDeliveryBatchValue.create([delivery])
    if (deliveries instanceof Error) return deliveries

    const result = await new PublishSystemNotification({
      notificationRepository: new SystemNotificationRepository({
        context: { env: { DB: this.c.env.DB } },
      }),
    }).execute({ message, deliveries })
    if (result instanceof Error) return result
    if (result.kind === "rejected") {
      return new Error(`notification publication rejected: ${result.reason}`)
    }

    return Object.freeze({
      id: notificationId,
      recipientAccountId: recipientAccountId.data,
      sourceDomain: props.sourceDomain,
      sourceId: props.sourceId,
      kind: props.kind,
      title: props.title,
      body: props.body,
      isRead: false as const,
      createdAt: props.createdAt,
    })
  }
}
