import { PrepareLeaveDecisionNotificationAdapter } from "@/contexts/leave/infrastructure/adapters/prepare-leave-decision-notification.adapter"
import { CompleteRejectedLeaveProcedure } from "@/contexts/leave/application/complete-rejected-leave-procedure"
import { CompleteApprovedLeaveProcedure } from "@/contexts/leave/application/complete-approved-leave-procedure"
import { expect, spyOn, test } from "bun:test"
import { RecordLeaveDecision } from "@/contexts/leave/application/record-leave-decision"
import { createLeaveProcedureTestContext } from "@/contexts/leave/test/leave-procedure.test-support"
import { createTestContextForDatabase } from "@tests/api/support/create-test-context"

test.each(["approve", "reject"] as const)(
  "合議の票を重複なく記録し、最終確定までは残数を消費しない: %s",
  async (action) => {
    const c = await createLeaveProcedureTestContext()
    const binding = await c.repository.submit(c.submission)
    if (binding instanceof Error) throw binding
    await c.database.exec(`INSERT INTO system_iam_roles
    (id, key, kind, name, created_at, updated_at) VALUES ('leave-approve-role', 'test:leave-approve', 'custom', 'Leave decision', 0, 0);
    INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('leave-approve-role', 'leave:approve');`)
    await c.database
      .prepare(
        "INSERT INTO leave_balances (employee_id, fiscal_year, leave_type, granted_days, used_days, remaining_days) VALUES (?1, '2026', 'annual', 10, 0, 10)",
      )
      .bind(c.creator.employeeId)
      .run()
    const base = createTestContextForDatabase(c.database)
    const application = new RecordLeaveDecision({
      ...base,
      env: { ...base.env, NOW: c.at.toISOString() },
    })
    for (const [index, actor] of c.people.slice(1, 3).entries()) {
      await c.database
        .prepare(
          "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES (?1, ?2, 'leave-approve-role', 0)",
        )
        .bind(`leave-approval:${actor.accountId}`, actor.accountId)
        .run()
      const command = {
        leaveRequestId: c.requestId,
        session: {
          accountId: actor.accountId,
          employeeId: actor.employeeId,
          hasPermission: (key: string) => key === "leave:approve",
        },
        tokenVersion: 0,
        decisionTarget: {
          proposalVersion: 1,
          proposalDigest: binding.proposalDigest,
          taskKey: c.step.key,
          taskRound: 1,
        },
        action,
        comment: "Reviewed",
        decidedAt: c.at,
      }
      const decided = await application.run(command)
      expect(decided).not.toBeInstanceOf(Error)
      if (decided instanceof Error) throw decided
      expect(decided.status).toBe(
        index === 0 ? "pending" : action === "approve" ? "approved" : "rejected",
      )
      expect(decided.needsExecution).toBe(index === 1)
      expect(await application.run(command)).toEqual({ ...decided, replayed: true })
      expect(
        await c.database
          .prepare("SELECT remaining_days FROM leave_balances WHERE employee_id = ?1")
          .bind(c.creator.employeeId)
          .first<number>("remaining_days"),
      ).toBe(10)
    }
    expect(
      await c.database
        .prepare("SELECT count(*) AS count FROM system_human_attestations")
        .first<number>("count"),
    ).toBe(2)
    expect(
      await c.database
        .prepare("SELECT status FROM leave_requests WHERE id = ?1")
        .bind(c.requestId)
        .first<string>("status"),
    ).toBe("pending")
    {
      const actor = c.people[2]
      if (actor === undefined) throw new Error("executor missing")
      const complete = new (
        action === "approve" ? CompleteApprovedLeaveProcedure : CompleteRejectedLeaveProcedure
      )({
        ...base,
        env: { ...base.env, NOW: c.at.toISOString() },
      })
      const command = {
        leaveRequestId: c.requestId,
        tokenVersion: 0,
        completedAt: c.at,
        session: {
          accountId: actor.accountId,
          employeeId: actor.employeeId,
          hasPermission: (key: string) => key === "leave:approve",
        },
      }
      if (action === "reject") {
        const outsider = c.people[3]
        if (outsider === undefined) throw new Error("nonparticipant missing")
        await c.database
          .prepare(
            "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES ('leave-outsider', ?1, 'leave-approve-role', 0)",
          )
          .bind(outsider.accountId)
          .run()
        expect(
          await complete.run({
            ...command,
            session: {
              ...command.session,
              accountId: outsider.accountId,
              employeeId: outsider.employeeId,
            },
          }),
        ).toBeInstanceOf(Error)
        expect(
          await complete.run({ ...command, completedAt: new Date(c.at.getTime() - 1) }),
        ).toBeInstanceOf(Error)
      }
      const notificationAdapter = new PrepareLeaveDecisionNotificationAdapter(base)
      const prepareNotification = notificationAdapter.prepare.bind(notificationAdapter)
      const interception = spyOn(
        PrepareLeaveDecisionNotificationAdapter.prototype,
        "prepare",
      ).mockImplementationOnce(async (notification, accountId) => {
        const queued = await prepareNotification(notification, accountId)
        await c.database
          .prepare("UPDATE system_accounts SET token_version = 1 WHERE id = ?1")
          .bind(actor.accountId)
          .run()
        return queued
      })
      try {
        expect(await complete.run(command)).toBeInstanceOf(Error)
        expect(
          await c.database
            .prepare("SELECT status FROM leave_requests WHERE id = ?1")
            .bind(c.requestId)
            .first<string>("status"),
        ).toBe("pending")
        expect(
          await c.database
            .prepare("SELECT count(*) AS count FROM leave_decision_notifications")
            .first<number>("count"),
        ).toBe(0)
      } finally {
        interception.mockRestore()
        command.tokenVersion = 1
      }
      await c.database.exec(
        "CREATE TRIGGER fail_leave_notification BEFORE INSERT ON leave_decision_notifications BEGIN SELECT RAISE(ABORT, 'notification failed'); END;",
      )
      expect(await complete.run(command)).toBeInstanceOf(Error)
      expect(
        await c.database
          .prepare("SELECT remaining_days FROM leave_balances WHERE employee_id = ?1")
          .bind(c.creator.employeeId)
          .first<number>("remaining_days"),
      ).toBe(10)
      expect(
        await c.database
          .prepare("SELECT count(*) AS count FROM system_execution_authorizations")
          .first<number>("count"),
      ).toBe(0)
      expect(
        await c.database
          .prepare("SELECT status FROM leave_requests WHERE id = ?1")
          .bind(c.requestId)
          .first<string>("status"),
      ).toBe("pending")
      expect(
        await c.database
          .prepare("SELECT count(*) AS count FROM leave_decision_notifications")
          .first<number>("count"),
      ).toBe(0)
      await c.database.exec("DROP TRIGGER fail_leave_notification")
      if (action === "approve") {
        await c.database
          .prepare(
            "UPDATE leave_balances SET granted_days = 0, remaining_days = 0 WHERE employee_id = ?1",
          )
          .bind(c.creator.employeeId)
          .run()
        expect(await complete.run(command)).toBeInstanceOf(Error)
        expect(
          await c.database
            .prepare("SELECT status FROM leave_requests WHERE id = ?1")
            .bind(c.requestId)
            .first<string>("status"),
        ).toBe("pending")
        await c.database
          .prepare(
            "UPDATE leave_balances SET granted_days = 10, remaining_days = 10 WHERE employee_id = ?1",
          )
          .bind(c.creator.employeeId)
          .run()
      }
      const completions = await Promise.all([complete.run(command), complete.run(command)])
      for (const completion of completions) expect(completion).not.toBeInstanceOf(Error)
      expect(
        completions.filter((completion) => !(completion instanceof Error) && !completion.replayed),
      ).toHaveLength(1)
      expect(
        completions.filter((completion) => !(completion instanceof Error) && completion.replayed),
      ).toHaveLength(1)
      const completed = completions.find(
        (completion) => !(completion instanceof Error) && !completion.replayed,
      )
      if (completed === undefined) throw new Error("completion missing")
      expect(completed).not.toBeInstanceOf(Error)
      if (completed instanceof Error) throw completed
      expect(completed).toEqual({
        status: action === "approve" ? "approved" : "rejected",
        replayed: false,
      })
      expect(await complete.run(command)).toEqual({
        status: action === "approve" ? "approved" : "rejected",
        replayed: true,
      })
      expect(
        await c.database
          .prepare("SELECT remaining_days FROM leave_balances WHERE employee_id = ?1")
          .bind(c.creator.employeeId)
          .first<number>("remaining_days"),
      ).toBe(action === "approve" ? 9 : 10)
      expect(
        await c.database
          .prepare("SELECT count(*) AS count FROM leave_decision_notifications")
          .first<number>("count"),
      ).toBe(1)
      await c.database
        .prepare(
          "DELETE FROM system_role_bindings WHERE account_id = ?1 AND role_id = 'leave-approve-role'",
        )
        .bind(actor.accountId)
        .run()
      expect(await complete.run(command)).toBeInstanceOf(Error)
    }
  },
)
