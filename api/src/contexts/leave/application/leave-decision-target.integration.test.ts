import { describe, expect, test } from "bun:test"
import { ApproveLeaveRequest } from "@/contexts/leave/application/approve-leave-request"
import { RejectLeaveRequest } from "@/contexts/leave/application/reject-leave-request"
import { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { createLeaveDecisionTestContext } from "@/contexts/leave/test/leave-decision.test-support"
import { readLeaveDecisionTarget } from "@/contexts/leave/test/read-leave-decision-target.test-support"
import { reviewLeaveRequest } from "@/contexts/leave/test/review-leave-request.test-support"
import {
  zAppLeaveRequestInboxList,
  zAppLeaveRequestDetail,
} from "@/contexts/leave/interface/http/response-schemas"
import { ConflictError } from "@/lib/errors"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"

const jwtSecret = "leave-review-target-test-secret"

for (const mode of ["approve-balanced", "approve-untracked", "reject"] as const) {
  async function fixture() {
    const f = await createLeaveDecisionTestContext(
      mode === "approve-untracked" ? "compensatory" : "annual",
    )
    const operation = mode === "reject" ? "reject" : "approve"
    const application = () =>
      operation === "reject"
        ? new RejectLeaveRequest({ context: f.context })
        : new ApproveLeaveRequest({ context: f.context })
    const token = await createTestToken(jwtSecret, { employeeId: f.command.approverId })
    const read = () =>
      readLeaveDecisionTarget(f.db, jwtSecret, f.context.env.NOW, f.request.id!, token)
    const http = (path: string, body?: unknown) =>
      requestWithContext({
        db: f.db,
        jwtSecret,
        now: f.context.env.NOW,
        path,
        token,
        method: body === undefined ? "GET" : "POST",
        body,
      })
    const decide = (target: unknown) =>
      http(`/leave/leave-requests/${f.request.id}/${operation}`, {
        comment: "Confirmed",
        decision_target: target,
      })
    return { ...f, application, read, http, decide }
  }

  describe(`確認した休暇内容: ${mode}`, () => {
    test("詳細とinboxで同じ確認対象を返し、判断の監査にも固定する", async () => {
      const f = await fixture()
      const target = await f.read()
      const inbox = await f.http("/leave/leave-requests/inbox")
      expect(inbox.status).toBe(200)
      const body = zAppLeaveRequestInboxList.parse(await inbox.json())
      expect(body.data).toHaveLength(1)
      expect(body.data[0]).toMatchObject({
        employee_id: f.request.employeeId,
        consumed_days: 3,
        decision_target: target,
      })
      expect(target).toEqual(f.command.decisionTarget)
      expect((await f.decide(target)).status).toBe(200)
      const audit = await f.db
        .prepare(
          "SELECT authorization_json AS auth FROM system_audit_events WHERE action LIKE 'leave.request.%'",
        )
        .first<{ auth: string }>()
      expect(JSON.parse(audit!.auth).decisionTarget).toEqual(target)
      const detail = await f.http(`/leave/leave-requests/${f.request.id}`)
      expect(zAppLeaveRequestDetail.parse(await detail.json()).decision_target).toBeNull()
      expect((await f.decide(target)).status).toBe(409)
      expect(await f.persisted()).toEqual({
        status: mode === "reject" ? "rejected" : "approved",
        used: mode === "approve-balanced" ? 3 : 0,
        audits: 1,
      })
    })

    test.each([
      ["reason", "Changed reason"],
      ["reason", null],
      ["start_date", "2026-06-21"],
      ["end_date", "2026-06-23"],
      ["days", 4],
      ["consumed_days", 4],
      ["unit", "hourly"],
      ["hours", 2],
      ["leave_type", "special"],
      ["created_at", "2026-06-02T00:00:00.000Z"],
    ] as const)("確認後に内容が変われば無変更で拒否する: %s = %s", async (field, value) => {
      const f = await fixture()
      const target = await f.read()
      await f.db
        .prepare(`UPDATE leave_requests SET ${field} = ?1 WHERE id = ?2`)
        .bind(value, f.request.id)
        .run()
      const result = await f.application().execute({ ...f.command, decisionTarget: target })
      expect(result).toBeInstanceOf(ConflictError)
      expect(result).toMatchObject({ code: "leave_request_changed" })
      expect((await f.decide(target)).status).toBe(409)
      expect(await f.persisted()).toEqual({ status: "pending", used: 0, audits: 0 })
    })

    test("再確認した内容だけを判断できる", async () => {
      const f = await fixture()
      const old = await f.read()
      await f.db
        .prepare("UPDATE leave_requests SET reason = 'Revised reason' WHERE id = ?1")
        .bind(f.request.id)
        .run()
      expect((await f.decide(old)).status).toBe(409)
      const fresh = await f.read()
      expect(fresh.request_digest).not.toBe(old.request_digest)
      expect((await f.decide(fresh)).status).toBe(200)
    })

    test("別申請の確認対象を流用できない", async () => {
      const f = await fixture()
      const other = await f.repository.create(
        LeaveRequest.create({
          employeeId: f.request.employeeId,
          leaveType: f.request.leaveType,
          startDate: "2026-07-20",
          endDate: "2026-07-22",
          days: f.request.days,
          unit: f.request.unit,
          hours: f.request.hours,
          consumedDays: f.request.consumedDays,
          reason: f.request.reason,
          createdAt: f.request.createdAt,
        }),
      )
      if (other instanceof Error || other === null) throw new Error("fixture failed")
      const target = await reviewLeaveRequest(other)
      expect(target.request_digest).not.toBe(f.command.decisionTarget.request_digest)
      expect((await f.decide(target)).status).toBe(409)
      expect((await f.decide({ ...target, request_id: f.request.id })).status).toBe(409)
      expect(await f.persisted()).toEqual({ status: "pending", used: 0, audits: 0 })
    })

    test.each([
      undefined,
      null,
      {},
      { request_id: 1, request_digest: "bad" },
      { request_id: 0, request_digest: "a".repeat(64) },
    ])("確認対象が不正なら入力段階で拒否する: %j", async (target) => {
      const f = await fixture()
      expect((await f.decide(target)).status).toBe(400)
      expect(await f.persisted()).toEqual({ status: "pending", used: 0, audits: 0 })
    })
  })
}
