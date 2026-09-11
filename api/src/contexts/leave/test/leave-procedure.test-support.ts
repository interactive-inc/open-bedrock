import { createTestContextForDatabase } from "@tests/api/support/create-test-context"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { ResolveCompanyGovernanceTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-governance-task.adapter"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { LeaveProcedureRepository } from "@/contexts/leave/infrastructure/repositories/leave-procedure.repository"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { ProposalEntity } from "@system/domain/entities/proposal.entity"
import { SystemCaseEntity } from "@system/domain/entities/system-case.entity"
import { createProposalId } from "@system/domain/schemas/workflow/proposal-id.schema"
import { createSystemCaseId } from "@system/domain/schemas/workflow/system-case.schema"
import { createSystemDecisionTask } from "@system/domain/policies/decision-task.policy"

/** 実migrationと公開Companyの責務を使い、業務休暇とSystem案件を一緒に保存する。 */
export async function createLeaveProcedureTestContext() {
  const c = await createGovernanceTaskTestContext()
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
  const published = await new SystemD1ProcedureRepository(c.context).publish(definition, 0)
  if (published !== true) throw published
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
    (employee_id, leave_type, start_date, end_date, days, unit, consumed_days, reason, status, created_at)
    VALUES (?1, 'annual', '2027-01-01', '2027-01-01', 1, 'full_day', 1, 'Leave', 'pending', ?2)
    RETURNING id`)
    .bind(requester.employeeId, c.at.toISOString())
    .first<number>("id")
  if (requestId === null) throw new Error("leave fixture missing")
  const resolved = await new ResolveCompanyGovernanceTaskAdapter(c.context).resolve({
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
