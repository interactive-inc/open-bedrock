import { resolveCompanyGovernanceTask } from "@/contexts/company/interface/operations/resolve-company-governance-task"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { RingiRequest } from "@/contexts/ringi/domain/entities/ringi-request.entity"
import { RingiRequestRepository } from "@/contexts/ringi/infrastructure/repositories/ringi-request.repository"
import { CompleteApprovedRingiProcedure } from "@/contexts/ringi/application/complete-approved-ringi-procedure"
import { openSystemWorkflow } from "@system/interface/operations/open-system-workflow"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { ProposalEntity } from "@system/domain/entities/proposal.entity"
import { SystemCaseEntity } from "@system/domain/entities/system-case.entity"
import { createProposalId } from "@system/domain/schemas/workflow/proposal-id.schema"
import { createSystemCaseId } from "@system/domain/schemas/workflow/system-case.schema"
import { createSystemDecisionTask } from "@system/domain/policies/decision-task.policy"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { createLocalD1Governance } from "@tests/d1/support/create-local-d1-governance"
import { execSql } from "@tests/d1/support/exec-sql"

/** migration済みのローカルD1と公開Companyの責務を使い、業務稟議とSystem案件を一緒に保存する。 */
export async function createRingiProcedureTestContext(database: D1Database) {
  const c = await createLocalD1Governance(database)
  const requester = c.creator
  const first = c.people[1]
  const second = c.people[2]
  if (first === undefined || second === undefined) throw new Error("approvers are missing")
  await execSql(
    c.database,
    `INSERT INTO system_iam_roles
    (id, key, kind, name, created_at, updated_at) VALUES ('ringi-test-role', 'test:ringi', 'custom', 'Ringi approval', 0, 0);
    INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('ringi-test-role', 'ringi:approve'), ('ringi-test-role', 'ringi:submit');`,
  )
  for (const person of [requester, first, second])
    await c.database
      .prepare(`INSERT INTO system_role_bindings
      (id, account_id, role_id, created_at) VALUES (?1, ?2, 'ringi-test-role', 0)`)
      .bind(`ringi-test:${person.accountId}`, person.accountId)
      .run()
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: [],
    workflow: { version: 1, steps: [c.step] },
  })
  if (policy instanceof Error) throw policy
  const definition = ProcedureDefinitionEntity.create({
    key: "ringi_request",
    revision: 1,
    title: "Ringi approval",
    category: "ringi",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: policy,
    completionOperationKey: "ringi.request.authorize",
    createdByAccountId: requester.accountId,
    createdAt: c.at,
  })
  if (definition instanceof Error) throw definition
  const published = await openSystemProcedures(c.context).publish(definition, 0)
  if (published !== true) throw published
  const ringi = RingiRequest.create({
    applicantId: requester.employeeId,
    approverId: first.employeeId,
    title: "Equipment purchase",
    amount: 500,
    reason: "Replace equipment",
    createdAt: c.at.toISOString(),
  })
  const resolved = await resolveCompanyGovernanceTask(c.context, {
    step: c.step,
    payload: ringi.toProposalBody(),
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
    body: ringi.toProposalBody(),
    createdByAccountId: requester.accountId,
    supersedesProposalId: null,
    createdAt: c.at,
  })
  if (proposal instanceof Error) throw proposal
  const workflowCase = SystemCaseEntity.create({
    id: createSystemCaseId(),
    subject: { context: "ringi", kind: "request", id: requestKey, version: "1" },
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
    action: "ringi.request.submitted",
    targetType: "ringi.request",
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
  const repository = new RingiRequestRepository(c.context)
  const submission = {
    requestKey,
    ringi,
    workflow: { proposal, workflowCase, firstTask },
    guards: resolved.guards,
    audit,
  }
  const approve = async (person: typeof first) => {
    const approved = await new ApproveSystemTask(openSystemWorkflow(c.context)).execute({
      caseId: workflowCase.id,
      taskKey: c.step.key,
      round: 1,
      actorAccountId: person.accountId,
      representedAccountId: person.accountId,
      delegationId: null,
      proposalDigest: proposal.digest,
      comment: "Reviewed",
      decidedAt: c.at,
      nextTask: null,
    })
    if (approved instanceof Error) throw approved
    return approved
  }
  const command = (ringiId: string) => ({
    ringiId,
    session: {
      accountId: second.accountId,
      employeeId: second.employeeId,
      hasPermission: (key: string) => key === "ringi:approve",
    },
    tokenVersion: 0,
    completedAt: c.at,
  })
  return {
    ...c,
    requester,
    first,
    second,
    repository,
    submission,
    approve,
    command,
    complete: new CompleteApprovedRingiProcedure(c.context),
  }
}
