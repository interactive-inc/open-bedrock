import { describe, expect, spyOn, test } from "bun:test"
import { ApproveLeaveRequest } from "@/contexts/leave/application/approve-leave-request"
import { RejectLeaveRequest } from "@/contexts/leave/application/reject-leave-request"
import { LeaveDecisionRepository } from "@/contexts/leave/infrastructure/repositories/leave-decision.repository"
import { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { createLeaveDecisionTestContext } from "@/contexts/leave/test/leave-decision.test-support"
import { ForbiddenError, ConflictError, UnexpectedError } from "@/lib/errors"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { PrepareLeaveDecisionAdapter } from "@/contexts/leave/infrastructure/adapters/prepare-leave-decision.adapter"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { createTestToken } from "@tests/api/support/create-test-token"

const modes = ["approve-balanced", "approve-untracked", "reject"] as const

for (const mode of modes) {
  const fixture = async () => {
    const f = await createLeaveDecisionTestContext(
      mode === "approve-untracked" ? "menstrual" : "annual",
    )
    const application = () => {
      if (mode === "reject") return new RejectLeaveRequest({ context: f.context })
      return new ApproveLeaveRequest({ context: f.context })
    }
    return { ...f, application }
  }

  describe(`leave human decision: ${mode}`, () => {
    test("現在の人と会社資格、判断内容を監査に残し、再送で残数と監査を増やさない", async () => {
      const f = await fixture()
      expect(await f.application().execute(f.command)).toBeInstanceOf(LeaveRequest)
      const saved = await f.persisted()
      expect(saved).toEqual({
        status: mode === "reject" ? "rejected" : "approved",
        used: mode === "approve-balanced" ? 3 : 0,
        audits: 1,
      })
      const audit = await f.db
        .prepare(`SELECT actor_account_id, authorization_json,
        before_json, after_json, occurred_at FROM system_audit_events WHERE action LIKE 'leave.request.%'`)
        .first<{
          actor_account_id: string
          authorization_json: string
          before_json: string
          after_json: string
          occurred_at: number
        }>()
      if (audit === null) throw new Error("audit missing")
      expect(audit.actor_account_id).toBe("2")
      expect(JSON.parse(audit.authorization_json)).toMatchObject({
        principalId: "test:human:2",
        employeeId: "2",
        permission: "leave:approve",
        snapshot: { asOf: "2026-06-15" },
        qualification: { criterionIndex: expect.any(Number) },
      })
      expect(JSON.parse(audit.before_json)).toMatchObject({
        status: "pending",
        reason: "Personal time",
        consumedDays: 3,
      })
      expect(JSON.parse(audit.after_json)).toMatchObject({
        status: saved?.status,
        approverId: "2",
        decidedComment: f.command.comment,
      })
      expect(audit.occurred_at).toBe(Date.parse(f.context.env.NOW))
      expect(await f.application().execute(f.command)).toBeInstanceOf(ConflictError)
      expect(await f.persisted()).toEqual(saved)
    })

    test.each([
      "missing-human",
      "agent",
      "locked-account",
      "stale-token",
      "revoked-permission",
      "missing-link",
      "unrelated-admin",
      "spoofed-employee",
      "on-leave",
      "retired",
      "removed-manager",
    ])("判断資格を失った主体を拒否する: %s", async (kind) => {
      const f = await fixture()
      let command = f.command
      if (kind === "missing-human")
        await f.db.exec("DELETE FROM system_principals WHERE account_id = '2'")
      if (kind === "agent")
        await f.db.exec(
          "UPDATE system_principals SET kind = 'agent', revision = revision + 1 WHERE account_id = '2'",
        )
      if (kind === "locked-account")
        await f.db.exec(
          "UPDATE system_accounts SET status = 'suspended', token_version = token_version + 1, updated_at = 1 WHERE id = '2'",
        )
      if (kind === "stale-token")
        await f.db.exec("UPDATE system_accounts SET token_version = 1 WHERE id = '2'")
      if (kind === "revoked-permission")
        await f.db.exec("UPDATE system_role_bindings SET revoked_at = 1 WHERE account_id = '2'")
      if (kind === "missing-link") {
        await f.db
          .exec(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('3', 'active', 0, 0, 0);
          INSERT INTO system_principals (id, account_id, kind, name, revision, created_at, updated_at) VALUES ('unlinked-human', '3', 'human', 'Unlinked human', 1, 0, 0);
          INSERT INTO system_role_bindings (id, account_id, role_id, created_at)
          SELECT 'unlinked-role', '3', id, 0 FROM system_iam_roles WHERE key = 'company:manager';`)
        command = {
          ...command,
          session: makeTestSession("manager", 3),
          approverId: toWorkforceEmployeeId(3),
        }
      }
      if (kind === "unrelated-admin")
        command = {
          ...command,
          session: makeTestSession("root", 1),
          approverId: toWorkforceEmployeeId(1),
        }
      if (kind === "spoofed-employee") command = { ...command, session: makeTestSession("root", 1) }
      if (kind === "on-leave") await f.changeManager("leave")
      if (kind === "retired") await f.changeManager("retired")
      if (kind === "removed-manager") await f.changeManager("active")
      expect(await f.application().execute(command)).toBeInstanceOf(ForbiddenError)
      expect(await f.persisted()).toEqual({ status: "pending", used: 0, audits: 0 })
    })

    test.each([
      "token",
      "permission",
      "agent",
      "account",
      "company",
      "retirement",
      "request-content",
    ])("保存直前の変更で判断を全取消しする: %s", async (kind) => {
      const f = await fixture()
      const repository = new LeaveDecisionRepository(f.context)
      const commit = repository.commit.bind(repository)
      const interception = spyOn(
        LeaveDecisionRepository.prototype,
        "commit",
      ).mockImplementationOnce(async (input) => {
        if (kind === "token")
          await f.db.exec("UPDATE system_accounts SET token_version = 1 WHERE id = '2'")
        if (kind === "permission")
          await f.db.exec("UPDATE system_role_bindings SET revoked_at = 1 WHERE account_id = '2'")
        if (kind === "agent")
          await f.db.exec(
            "UPDATE system_principals SET kind = 'agent', revision = revision + 1 WHERE account_id = '2'",
          )
        if (kind === "account")
          await f.db.exec(
            "UPDATE system_accounts SET status = 'suspended', token_version = token_version + 1, updated_at = 1 WHERE id = '2'",
          )
        if (kind === "company") await f.changeManager("active")
        if (kind === "retirement") await f.changeManager("retired")
        if (kind === "request-content")
          await f.db
            .prepare(
              "UPDATE leave_requests SET consumed_days = 4, reason = 'Updated request' WHERE id = ?",
            )
            .bind(f.request.id)
            .run()
        return commit(input)
      })
      try {
        expect(await f.application().execute(f.command)).toBeInstanceOf(Error)
        expect(await f.persisted()).toEqual({ status: "pending", used: 0, audits: 0 })
      } finally {
        interception.mockRestore()
      }
    })

    test.each(["abort", "ignore"])(
      "監査を保存できなければ残数と判断を全取消しする: %s",
      async (kind) => {
        const f = await fixture()
        const statement =
          kind === "abort" ? "SELECT RAISE(ABORT, 'audit unavailable');" : "SELECT RAISE(IGNORE);"
        await f.db.exec(`CREATE TRIGGER fail_leave_audit BEFORE INSERT ON system_audit_events
        WHEN NEW.action LIKE 'leave.request.%' BEGIN ${statement} END;`)
        expect(await f.application().execute(f.command)).toBeInstanceOf(UnexpectedError)
        expect(await f.persisted()).toEqual({ status: "pending", used: 0, audits: 0 })
        await f.db.exec("DROP TRIGGER fail_leave_audit")
        expect(await f.application().execute(f.command)).toBeInstanceOf(LeaveRequest)
      },
    )

    test("通知が例外を返しても確定した判断を返す", async () => {
      const f = await fixture()
      const notifyApprovalResult = async () => {
        throw new Error("notification unavailable")
      }
      const application = () => {
        if (mode === "reject")
          return new RejectLeaveRequest({ context: f.context, notifyApprovalResult })
        return new ApproveLeaveRequest({ context: f.context, notifyApprovalResult })
      }
      const logging = spyOn(console, "error").mockImplementation(() => {})
      try {
        expect(
          await application().execute({ ...f.command, createdAt: "2000-01-01T00:00:00Z" }),
        ).toBeInstanceOf(LeaveRequest)
        expect(await f.persisted()).toMatchObject({ audits: 1 })
        expect(logging).toHaveBeenCalledTimes(1)
      } finally {
        logging.mockRestore()
      }
    })
  })
}

test.each(["approve", "reject"])(
  "HTTP %sは現在の人間だけを許可し、Bearer検査後の失効も拒否する",
  async (action) => {
    const f = await createLeaveDecisionTestContext()
    const secret = "leave-human-decision-route-test-secret"
    const request = async (employee = 2) =>
      requestWithContext({
        db: f.db,
        jwtSecret: secret,
        path: `/leave/leave-requests/${f.request.id}/${action}`,
        method: "POST",
        body: { comment: "Confirmed coverage" },
        now: f.context.env.NOW,
        token: await createTestToken(secret, { employeeId: toWorkforceEmployeeId(employee) }),
      })
    expect((await request(1)).status).toBe(403)
    await f.db.exec(
      "UPDATE system_principals SET kind = 'agent', revision = revision + 1 WHERE account_id = '2'",
    )
    expect((await request()).status).toBe(401)
    await f.db.exec(
      "UPDATE system_principals SET kind = 'human', revision = revision + 1 WHERE account_id = '2'",
    )
    const prepare = new PrepareLeaveDecisionAdapter(f.context).prepare.bind(
      new PrepareLeaveDecisionAdapter(f.context),
    )
    const interception = spyOn(
      PrepareLeaveDecisionAdapter.prototype,
      "prepare",
    ).mockImplementationOnce(async (input) => {
      expect(input.tokenVersion).toBe(0)
      await f.db.exec("UPDATE system_accounts SET token_version = 1 WHERE id = '2'")
      return prepare(input)
    })
    try {
      expect((await request()).status).toBe(403)
      expect(await f.persisted()).toEqual({ status: "pending", used: 0, audits: 0 })
    } finally {
      interception.mockRestore()
    }
  },
)
