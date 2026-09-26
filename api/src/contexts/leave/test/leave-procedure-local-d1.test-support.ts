import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { resolveCompanyGovernanceTask } from "@/contexts/company/interface/operations/resolve-company-governance-task"
import { CompleteApprovedLeaveProcedure } from "@/contexts/leave/application/complete-approved-leave-procedure"
import { CompleteRejectedLeaveProcedure } from "@/contexts/leave/application/complete-rejected-leave-procedure"
import { RecordLeaveDecision } from "@/contexts/leave/application/record-leave-decision"
import { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { LeaveProcedureRepository } from "@/contexts/leave/infrastructure/repositories/leave-procedure.repository"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { ProposalEntity } from "@system/domain/entities/proposal.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemCaseEntity } from "@system/domain/entities/system-case.entity"
import { createSystemDecisionTask } from "@system/domain/policies/decision-task.policy"
import { createProposalId } from "@system/domain/schemas/workflow/proposal-id.schema"
import { createSystemCaseId } from "@system/domain/schemas/workflow/system-case.schema"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { createTestContextForDatabase } from "@tests/api/support/create-context-for-database"
import { createLocalD1Governance } from "@tests/d1/support/create-local-d1-governance"
import type { LocalD1 } from "@tests/d1/support/start-local-d1"

async function runAll(database: D1Database, statements: ReadonlyArray<string>): Promise<void> {
  await database.batch(statements.map((statement) => database.prepare(statement)))
}

/** 実Company資格とSystem案件を持つ提出前の休暇を、名前付きのローカルD1へ用意する。 */
export async function createLeaveProcedureLocalD1Context(local: LocalD1, name: string) {
  const c = await createLocalD1Governance(await local.database(name))
  const requester = c.creator
  const assignment = c.resources.find((resource) => resource.type === "responsibility-assignment")
  if (
    assignment === undefined ||
    assignment.type !== "responsibility-assignment" ||
    c.step.governance_authority === undefined
  )
    throw new Error("responsibility fixture missing")
  await c.write([
    {
      ...assignment,
      revision: 2,
      attributes: { ...assignment.attributes, authorityScopeId: null },
    },
  ])
  const step = { ...c.step, governance_authority: { ...c.step.governance_authority, scope: null } }
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: [],
    workflow: { version: 1, steps: [step] },
  })
  if (policy instanceof Error) throw policy
  const definition = ProcedureDefinitionEntity.create({
    key: "leave_request",
    revision: 1,
    title: "Leave approval",
    category: "leave",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: policy,
    completionOperationKey: "leave.request.authorize",
    createdByAccountId: requester.accountId,
    createdAt: c.at,
  })
  if (definition instanceof Error) throw definition
  await publishLeaveProcedureDefinition(c.context, definition)
  const leave = LeaveRequest.create({
    employeeId: requester.employeeId,
    leaveType: "annual",
    startDate: "2027-01-01",
    endDate: "2027-01-01",
    days: 1,
    unit: "full_day",
    hours: null,
    consumedDays: 1,
    reason: "Leave",
    createdAt: c.at.toISOString(),
  })
  const requestId = await c.database
    .prepare(`INSERT INTO leave_requests
    (id, employee_id, leave_type, start_date, end_date, days, unit, consumed_days, reason, status, created_at)
    VALUES (?3, ?1, 'annual', '2027-01-01', '2027-01-01', 1, 'full_day', 1, 'Leave', 'pending', ?2)
    RETURNING id`)
    .bind(requester.employeeId, c.at.toISOString(), crypto.randomUUID())
    .first<string>("id")
  if (requestId === null) throw new Error("leave fixture missing")
  const resolved = await resolveCompanyGovernanceTask(c.context, {
    step,
    payload: leave.toProposalBody(),
    subjectEmployeeId: requester.employeeId,
    excludedEmployeeIds: new Set([requester.employeeId]),
    openedAt: c.at,
    dueAt: null,
    resolvedAt: c.at,
  })
  if (resolved instanceof Error) throw resolved
  const requestKey = crypto.randomUUID()
  const proposal = await ProposalEntity.create({
    id: createProposalId(),
    seriesId: requestKey,
    version: 1,
    procedureKey: definition.key,
    procedureRevision: definition.revision,
    body: leave.toProposalBody(),
    createdByAccountId: requester.accountId,
    supersedesProposalId: null,
    createdAt: c.at,
  })
  if (proposal instanceof Error) throw proposal
  const workflowCase = SystemCaseEntity.create({
    id: createSystemCaseId(),
    subject: { context: "leave", kind: "request", id: requestKey, version: "1" },
    proposalDigest: proposal.digest,
    createdByAccountId: requester.accountId,
    status: "pending",
    createdAt: c.at,
    updatedAt: c.at,
  })
  if (workflowCase instanceof Error) throw workflowCase
  const firstTask = createSystemDecisionTask({
    task: resolved.task,
    caseId: workflowCase.id,
    createdByAccountId: requester.accountId,
    proposalDigest: proposal.digest,
  })
  if (firstTask instanceof Error) throw firstTask
  const audit = SystemAuditEventEntity.create({
    actorAccountId: requester.accountId,
    action: "leave.request.submitted",
    targetType: "leave.request",
    targetId: requestKey,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: JSON.stringify({ proposalDigest: proposal.digest }),
    metadataJson: null,
    occurredAt: c.at,
  })
  if (audit instanceof Error) throw audit
  const repository = new LeaveProcedureRepository(createTestContextForDatabase(c.database))
  const submission = {
    requestKey,
    leaveRequestId: requestId,
    previousLeaveRequestId: null,
    workflow: { proposal, workflowCase, firstTask },
    guards: resolved.guards,
    audit,
  }
  return { ...c, repository, submission, requestId, step }
}

/** 提出済みの休暇へ判断権限と残数を用意し、判断と業務確定を個別に呼べるようにする。 */
export async function createLeaveProcedureDecisionLocalD1Context(local: LocalD1, name: string) {
  const c = await createLeaveProcedureLocalD1Context(local, name)
  const binding = await c.repository.submit(c.submission)
  if (binding instanceof Error) throw binding
  await runAll(c.database, [
    `INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
      VALUES ('9e6932f2-bd06-4f30-8df5-8fd06fd885b6','test:leave-decision','custom','Leave decision',0,0)`,
    `INSERT INTO system_iam_role_permissions (role_id,permission_key)
      VALUES ('9e6932f2-bd06-4f30-8df5-8fd06fd885b6','leave:approve')`,
  ])
  for (const actor of c.people) {
    await c.database
      .prepare(
        "INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES (?1,?2,'9e6932f2-bd06-4f30-8df5-8fd06fd885b6',0)",
      )
      .bind(crypto.randomUUID(), actor.accountId)
      .run()
  }
  await c.database
    .prepare(
      "INSERT INTO leave_balances (id, employee_id,fiscal_year,leave_type,granted_days,used_days,remaining_days) VALUES ('0190004c-0000-7000-8000-0000000000f1', ?1,'2026','annual',10,0,10)",
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

/** 休暇手続の定義を初版としてSystemへ公開する。System infrastructureへの依存をこのfileだけに留める。 */
export async function publishLeaveProcedureDefinition(
  context: CompanyContext,
  definition: ProcedureDefinitionEntity,
): Promise<void> {
  const published = await openSystemProcedures(context).publish(definition, 0)
  if (published !== true) throw published
}
