import { LeaveDecisionNotificationValue } from "@/contexts/leave/domain/values/leave-decision-notification.value"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { CompanyAccountEmployeeLinksReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-account-employee-links-read.adapter"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { toSha256Hex } from "@/lib/crypto/to-sha256-hex"
import { SystemManagedJobRunnerAdapter } from "@system/infrastructure/adapters/events/system-managed-job-runner.adapter"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"
import { SystemServiceOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-service-operation-authorization.adapter"
import type { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"
import { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"
import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"

type Context = Readonly<{
  env: Readonly<{ DB: D1Database; COMPANY_TIME_ZONE?: string }>
  accountId: AccountId
  clock: () => Date
}>

/** 休暇通知とjob完了を一括保存し、配送不能はSystemの再送・dead letterへ残す。 */
export class LeaveDecisionNotificationDeliveryAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  run(limit: number) {
    return new SystemManagedJobRunnerAdapter({
      env: this.c.env,
      workerAccountId: this.c.accountId,
      handlerKey: "leave.decision-notification",
      clock: this.c.clock,
      prepare: (job, at) => this.prepare(job, at),
    }).run(limit)
  }

  async prepare(
    job: SystemDeliveryEntity,
    at: Date,
  ): Promise<ReadonlyArray<D1PreparedStatement> | Error> {
    if (
      job.kind !== "job" ||
      job.handlerKey !== "leave.decision-notification" ||
      job.operationKey !== "leave.decision-notification"
    )
      return new Error("notification job is invalid")
    const tokenVersion = await this.c.env.DB.prepare(
      "SELECT token_version FROM system_accounts WHERE id = ?1",
    )
      .bind(this.c.accountId)
      .first<number>("token_version")
    if (tokenVersion === null) return new Error("notification Service is unavailable")
    const authorization = await new SystemServiceOperationAuthorizationAdapter(this.c).prepare({
      accountId: this.c.accountId,
      tokenVersion,
      permissions: ["batch:execute", "employee:read", "leave:read:all"],
      now: at,
    })
    if (authorization instanceof Error) return authorization
    if (authorization === "forbidden") return new Error("notification Service is not authorized")
    const payload = await this.c.env.DB.prepare(
      "SELECT payload_json FROM leave_decision_notifications WHERE job_id = ?1",
    )
      .bind(job.id)
      .first<string>("payload_json")
    if (payload === null || (await toSha256Hex(payload)) !== job.payloadDigest)
      return new Error("notification payload cannot be verified")
    const notification = LeaveDecisionNotificationValue.create(JSON.parse(payload))
    if (notification instanceof Error) return notification
    if (notification.deliveryId !== job.id || notification.toCanonicalJson() !== payload)
      return new Error("notification identity changed")
    if (at.getTime() < notification.props.decidedAt)
      return new Error("notification delivery precedes decision")
    const companyGuard = await new CompanyAuthoritySnapshotGuardAdapter({
      database: this.c.env.DB,
    }).prepare({ accountIds: [], employeeCodes: [] })
    if (companyGuard instanceof Error) return companyGuard
    const asOf = resolveCompanyBusinessDate({
      now: at.toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (asOf instanceof Error) return asOf
    const links = await new CompanyAccountEmployeeLinksReadAdapter(this.c).findMany({
      employeeIds: [notification.props.recipientEmployeeId],
      asOf,
    })
    if (links instanceof Error) return links
    const recipient = zAccountId.safeParse(links.length === 1 ? links[0]?.accountId : null)
    if (!recipient.success) return new Error("notification recipient is unavailable")
    const active = await this.c.env.DB.prepare(
      "SELECT id FROM system_accounts WHERE id = ?1 AND status = 'active' AND closed_at IS NULL",
    )
      .bind(recipient.data)
      .first<string>("id")
    if (active === null) return new Error("notification recipient account is unavailable")
    const publication = this.preparePublication(notification, recipient.data, at)
    if (publication instanceof Error) return publication
    const latestDay = resolveCompanyBusinessDate({
      now: this.c.clock().toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (latestDay instanceof Error || latestDay !== asOf)
      return new Error("notification Company day changed")
    return [
      ...authorization.assertions,
      companyGuard,
      this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (SELECT 1 FROM system_accounts WHERE id = ?1 AND status = 'active' AND closed_at IS NULL)
        THEN 1 ELSE json_extract('', '$') END AS ok`).bind(recipient.data),
      ...publication,
    ]
  }

  private preparePublication(
    notification: LeaveDecisionNotificationValue,
    recipient: AccountId,
    at: Date,
  ) {
    const message = NotificationMessageEntity.create({
      id: notification.deliveryId,
      kind: "company:approval_result",
      title: notification.title,
      body: null,
      source: {
        type: "company:notification.source",
        id: JSON.stringify({ domain: "leave", id: notification.props.leaveRequestId }),
      },
      createdAt: new Date(notification.props.decidedAt),
    })
    if (message instanceof Error) return message
    const delivery = NotificationDeliveryEntity.create({
      id: notification.deliveryId,
      messageId: message.id,
      recipientAccountId: recipient,
      deliveredAt: at,
      readAt: null,
    })
    if (delivery instanceof Error) return delivery
    const deliveries = NotificationDeliveryBatchValue.create([delivery])
    if (deliveries instanceof Error) return deliveries
    return new SystemNotificationRepository({ context: this.c }).preparePublish(message, deliveries)
  }
}
