import { expect, test } from "bun:test"
import { LeaveDecisionNotificationValue } from "@/contexts/leave/domain/values/leave-decision-notification.value"

const input = {
  decisionAuditId: "decision-1",
  leaveRequestId: 12,
  recipientEmployeeId: "employee-1",
  outcome: "approved",
  decidedAt: 1000,
}

test("保存・復元とキー順の違いで配送IDと通知内容を変えない", () => {
  const original = LeaveDecisionNotificationValue.create(input)
  const reordered = LeaveDecisionNotificationValue.create({
    decidedAt: input.decidedAt,
    outcome: input.outcome,
    recipientEmployeeId: input.recipientEmployeeId,
    leaveRequestId: input.leaveRequestId,
    decisionAuditId: input.decisionAuditId,
  })
  expect(original).toBeInstanceOf(LeaveDecisionNotificationValue)
  expect(reordered).toBeInstanceOf(LeaveDecisionNotificationValue)
  if (original instanceof Error || reordered instanceof Error) return
  expect(original.toCanonicalJson()).toBe(reordered.toCanonicalJson())
  const restored = LeaveDecisionNotificationValue.create(JSON.parse(original.toCanonicalJson()))
  expect(restored).toBeInstanceOf(LeaveDecisionNotificationValue)
  if (restored instanceof Error) return
  expect(restored.deliveryId).toBe(original.deliveryId)
  expect(restored.title).toBe("休暇申請が承認されました")
  expect(Object.isFrozen(restored.props)).toBe(true)
})

test("未確定の判断と休暇理由などの余分な内容を配送用データに持ち込まない", () => {
  expect(LeaveDecisionNotificationValue.create({ ...input, outcome: "pending" })).toBeInstanceOf(
    Error,
  )
  expect(
    LeaveDecisionNotificationValue.create({ ...input, reason: "private leave reason" }),
  ).toBeInstanceOf(Error)
  expect(LeaveDecisionNotificationValue.create({ ...input, decidedAt: -1 })).toBeInstanceOf(Error)
  expect(LeaveDecisionNotificationValue.create({ ...input, leaveRequestId: 1.5 })).toBeInstanceOf(
    Error,
  )
})

test("別の判断には別の配送IDを割り当てる", () => {
  const notification = LeaveDecisionNotificationValue.create({
    ...input,
    decisionAuditId: "decision-2",
    outcome: "rejected",
  })
  expect(notification).toBeInstanceOf(LeaveDecisionNotificationValue)
  if (notification instanceof Error) return
  expect(notification.deliveryId).toBe("leave-decision:decision-2")
  expect(notification.title).toBe("休暇申請が却下されました")
})
