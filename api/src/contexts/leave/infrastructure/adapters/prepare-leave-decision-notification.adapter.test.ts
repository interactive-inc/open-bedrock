import { expect, test } from "bun:test"
import { createLeaveDecisionTestContext } from "@/contexts/leave/test/leave-decision.test-support"
import { LeaveDecisionNotificationValue } from "@/contexts/leave/domain/values/leave-decision-notification.value"
import { PrepareLeaveDecisionNotificationAdapter } from "@/contexts/leave/infrastructure/adapters/prepare-leave-decision-notification.adapter"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

test("通知内容を監査と一緒に保存し、重複・変更・削除を拒否する", async () => {
  const fixture = await createLeaveDecisionTestContext()
  const context = fixture.context
  const actor = fixture.command.session.accountId
  const audit = SystemAuditEventEntity.create({
    actorAccountId: actor,
    action: "leave.approved",
    targetType: "leave.request",
    targetId: String(fixture.request.id),
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: null,
    occurredAt: new Date(context.env.NOW),
  })
  expect(audit).toBeInstanceOf(SystemAuditEventEntity)
  if (audit instanceof Error) return
  const notification = LeaveDecisionNotificationValue.create({
    decisionAuditId: audit.eventId,
    leaveRequestId: fixture.request.id,
    recipientEmployeeId: fixture.request.employeeId,
    outcome: "approved",
    decidedAt: new Date(context.env.NOW).getTime(),
  })
  expect(notification).toBeInstanceOf(LeaveDecisionNotificationValue)
  if (notification instanceof Error) return
  const statements = await new PrepareLeaveDecisionNotificationAdapter(context).prepare(
    notification,
    actor,
  )
  expect(statements).not.toBeInstanceOf(Error)
  if (statements instanceof Error) return
  expect(
    await context.env.DB.batch([...statements]).then(
      () => null,
      (error: unknown) => error,
    ),
  ).toBeInstanceOf(Error)
  expect(
    await context.env.DB.prepare("SELECT count(*) AS count FROM system_jobs WHERE id = ?1")
      .bind(notification.deliveryId)
      .first<number>("count"),
  ).toBe(0)
  await context.env.DB.batch([
    ...new SystemAuditEventRepository(context).prepareAppend(audit),
    ...statements,
  ])
  expect(
    await context.env.DB.prepare("SELECT status FROM system_jobs WHERE id = ?1")
      .bind(notification.deliveryId)
      .first<string>("status"),
  ).toBe("queued")
  expect(
    await context.env.DB.prepare(
      "SELECT payload_json FROM leave_decision_notifications WHERE job_id = ?1",
    )
      .bind(notification.deliveryId)
      .first<string>("payload_json"),
  ).toBe(notification.toCanonicalJson())
  expect(
    await context.env.DB.batch([...statements]).then(
      () => null,
      (error: unknown) => error,
    ),
  ).toBeInstanceOf(Error)
  expect(
    await context.env.DB.prepare(
      "UPDATE leave_decision_notifications SET payload_json = payload_json WHERE job_id = ?1",
    )
      .bind(notification.deliveryId)
      .run()
      .then(
        () => null,
        (error: unknown) => error,
      ),
  ).toBeInstanceOf(Error)
  expect(
    await context.env.DB.prepare("DELETE FROM leave_decision_notifications WHERE job_id = ?1")
      .bind(notification.deliveryId)
      .run()
      .then(
        () => null,
        (error: unknown) => error,
      ),
  ).toBeInstanceOf(Error)
})
