import { createLeaveProcedureTestContext } from "@/contexts/leave/test/leave-procedure.test-support"
import { createTestContextForDatabase } from "@tests/api/support/create-test-context"
import { RecordLeaveDecision } from "@/contexts/leave/application/record-leave-decision"
import { CompleteApprovedLeaveProcedure } from "@/contexts/leave/application/complete-approved-leave-procedure"
import { CompleteRejectedLeaveProcedure } from "@/contexts/leave/application/complete-rejected-leave-procedure"

/** 実Company資格とSystem案件を用意し、判断と業務確定を個別に検査する。 */
export async function createLeaveProcedureDecisionTestContext() {
  const c = await createLeaveProcedureTestContext()
  const binding = await c.repository.submit(c.submission)
  if (binding instanceof Error) throw binding
  await c.database.exec(`INSERT INTO system_iam_roles
    (id,key,kind,name,created_at,updated_at) VALUES ('leave-decision-test','test:leave-decision','custom','Leave decision',0,0);
    INSERT INTO system_iam_role_permissions (role_id,permission_key) VALUES ('leave-decision-test','leave:approve');`)
  for (const actor of c.people) {
    await c.database
      .prepare(
        "INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES (?1,?2,'leave-decision-test',0)",
      )
      .bind(`leave-decision-test:${actor.accountId}`, actor.accountId)
      .run()
  }
  await c.database
    .prepare(
      "INSERT INTO leave_balances (employee_id,fiscal_year,leave_type,granted_days,used_days,remaining_days) VALUES (?1,'2026','annual',10,0,10)",
    )
    .bind(c.creator.employeeId)
    .run()
  const base = createTestContextForDatabase(c.database)
  const context = { ...base, env: { ...base.env, NOW: c.at.toISOString() } }
  const command = (index: number, action: "approve" | "reject" = "approve") => {
    const actor = c.people[index]
    if (actor === undefined) throw new Error("decision actor missing")
    return {
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
  }
  const decide = (index: number, action: "approve" | "reject" = "approve") =>
    new RecordLeaveDecision(context).run(command(index, action))
  const complete = (action: "approve" | "reject" = "approve") => {
    const input = command(2, action)
    return new (action === "approve"
      ? CompleteApprovedLeaveProcedure
      : CompleteRejectedLeaveProcedure)(context).run({ ...input, completedAt: c.at })
  }
  const prepareCompletion = async (action: "approve" | "reject" = "approve") => {
    for (const index of [1, 2]) {
      const result = await decide(index, action)
      if (result instanceof Error) throw result
    }
  }
  const persisted = () =>
    c.database
      .prepare(`SELECT status,
    (SELECT used_days FROM leave_balances WHERE employee_id = ?2) AS used,
    (SELECT count(*) FROM system_human_attestations WHERE case_id = ?3) AS attestations,
    (SELECT count(*) FROM leave_decision_notifications WHERE leave_request_id = ?1) AS notifications
    FROM leave_requests WHERE id = ?1`)
      .bind(c.requestId, c.creator.employeeId, binding.caseId)
      .first<{ status: string; used: number; attestations: number; notifications: number }>()
  return { ...c, binding, context, command, decide, complete, prepareCompletion, persisted }
}
