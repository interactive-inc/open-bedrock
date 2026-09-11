import { expect, test } from "bun:test"
import { createLeaveDecisionTestContext } from "@/contexts/leave/test/leave-decision.test-support"
import { ApproveLeaveRequest } from "@/contexts/leave/application/approve-leave-request"
import { RejectLeaveRequest } from "@/contexts/leave/application/reject-leave-request"
import { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"

for (const outcome of ["approved", "rejected"] as const) {
  test.each(["abort", "ignore"])(
    `${outcome} %s: 通知待ちの保存失敗では判断・監査を確定せず、復旧後に一度だけ記録する`,
    async (failure) => {
      const f = await createLeaveDecisionTestContext()
      const execute = () => {
        if (outcome === "approved")
          return new ApproveLeaveRequest({ context: f.context }).execute(f.command)
        return new RejectLeaveRequest({ context: f.context }).execute(f.command)
      }
      await f.db.exec(
        `CREATE TRIGGER reject_notification_queue BEFORE INSERT ON leave_decision_notifications BEGIN ${failure === "abort" ? "SELECT RAISE(ABORT, 'notification queue unavailable');" : "SELECT RAISE(IGNORE);"} END`,
      )
      expect(await execute()).toBeInstanceOf(Error)
      expect(await f.persisted()).toEqual({ status: "pending", used: 0, audits: 0 })
      expect(
        await f.context.env.DB.prepare(
          "SELECT count(*) AS count FROM system_jobs WHERE handler_key = 'leave.decision-notification'",
        ).first<number>("count"),
      ).toBe(0)
      await f.db.exec("DROP TRIGGER reject_notification_queue")
      expect(await execute()).toBeInstanceOf(LeaveRequest)
      expect((await f.persisted())?.status).toBe(outcome)
      expect(
        await f.context.env.DB.prepare(
          "SELECT count(*) AS count FROM leave_decision_notifications WHERE leave_request_id = ?1",
        )
          .bind(f.request.id)
          .first<number>("count"),
      ).toBe(1)
      expect(await execute()).toBeInstanceOf(Error)
      expect(
        await f.context.env.DB.prepare(
          "SELECT count(*) AS count FROM leave_decision_notifications WHERE leave_request_id = ?1",
        )
          .bind(f.request.id)
          .first<number>("count"),
      ).toBe(1)
    },
  )
}
