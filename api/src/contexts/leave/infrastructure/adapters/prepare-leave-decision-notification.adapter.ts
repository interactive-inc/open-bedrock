import { LeaveDecisionNotificationValue } from "@/contexts/leave/domain/values/leave-decision-notification.value"
import { toSha256Hex } from "@/lib/crypto/to-sha256-hex"
import type { SystemD1Context } from "@system/configuration/system-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"
import { SystemDeliveryRepository } from "@system/infrastructure/repositories/events/system-delivery.repository"

type Context = SystemD1Context

/** 休暇の判断・監査と同じtransactionへ通知待ちを追加する。 */
export class PrepareLeaveDecisionNotificationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    notification: LeaveDecisionNotificationValue,
    actorAccountId: AccountId,
  ): Promise<ReadonlyArray<D1PreparedStatement> | Error> {
    const payload = notification.toCanonicalJson()
    const now = new Date(notification.props.decidedAt)
    const job = SystemDeliveryEntity.create({
      id: notification.deliveryId,
      kind: "job",
      handlerKey: "leave.decision-notification",
      operationKey: "leave.decision-notification",
      payloadDigest: await toSha256Hex(payload),
      idempotencyKey: notification.deliveryId,
      status: "queued",
      attempt: 0,
      maxAttempts: 10,
      availableAt: now,
      leaseAccountId: null,
      leaseTokenHash: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    })
    if (job instanceof Error) return job
    const queued = new SystemDeliveryRepository(this.c).prepareCreate(job, actorAccountId, null)
    if (queued instanceof Error) return queued
    return [
      ...queued,
      this.c.env.DB.prepare(`INSERT INTO leave_decision_notifications
        (job_id, leave_request_id, decision_audit_id, payload_json) VALUES (?1, ?2, ?3, ?4)`).bind(
        notification.deliveryId,
        notification.props.leaveRequestId,
        notification.props.decisionAuditId,
        payload,
      ),
      this.c.env.DB.prepare(`SELECT CASE WHEN changes() = 1 AND EXISTS (
        SELECT 1 FROM leave_decision_notifications
        WHERE job_id = ?1 AND leave_request_id = ?2 AND decision_audit_id = ?3 AND payload_json = ?4
      ) THEN 1 ELSE json_extract('', '$') END AS ok`).bind(
        notification.deliveryId,
        notification.props.leaveRequestId,
        notification.props.decisionAuditId,
        payload,
      ),
    ]
  }
}
