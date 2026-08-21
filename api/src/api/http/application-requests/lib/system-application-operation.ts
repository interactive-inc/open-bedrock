import { resolveActiveSystemAccountId } from "@/contexts/company/infrastructure/iam/resolve-active-system-account-id.repository"
import { resolveActiveCompanyAccountParticipant } from "@/contexts/company/infrastructure/iam/resolve-active-company-account-participant.repository"
import { resolveCompanyAccountParticipants } from "@/contexts/company/infrastructure/iam/resolve-company-account-participants.repository"
import { resolveSystemAccountIdsForEmployees } from "@/contexts/company/infrastructure/iam/resolve-system-account-ids-for-employees.repository"
import { resolveCompanyProcedureTask } from "@/contexts/company/infrastructure/organization/resolve-company-procedure-task.repository"
import { type CompanyProcedureDecisionPolicy } from "@/contexts/company/domain/organization/company-procedure-decision-policy"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/organization/parse-company-procedure-decision-policy"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee.repository"
import { CompleteApprovedPersonnelActionRequest } from "@/contexts/company/application/employee-lifecycle/procedure/complete-approved-personnel-action-request"
import { findPersonnelActionRequest } from "@/contexts/company/infrastructure/employee-lifecycle/find-personnel-action-request.repository"
import type { Context } from "@/env"
import { canRepairWorkflow } from "@/api/http/application-requests/lib/can-repair-workflow"
import { parseJsonValue } from "@/api/http/application-requests/lib/parse-json-value"
import { isUniqueConstraintError } from "@/lib/d1/is-unique-constraint-error"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  UnprocessableError,
} from "@/lib/errors"
import {
  loadSystemProcedure,
  parseSystemProcedureInputSchema,
  parseSystemProcedurePolicy,
} from "@/api/http/application-templates/lib/system-procedure-route"
import { validateAndNormalizeApplicationPayload } from "@/api/http/application-requests/lib/validate-system-procedure-payload"
import { CancelSystemProcedure } from "@system/application/workflow/cancel-system-procedure"
import {
  createSystemDecisionTask,
  type StartSystemProcedureTask,
} from "@system/domain/policies/decision-task.policy"
import { DecideSystemTask } from "@system/application/workflow/decide-system-task"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import type { SystemProposalView } from "@system/infrastructure/workflow/system-d1-proposal-query.repository"
import { systemCaseIdSchema } from "@system/domain/values/system-case.schema"
import { CanonicalSystemJsonValue } from "@system/domain/values/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/proposal-digest.value"
import { SystemD1ProposalQuery } from "@system/infrastructure/workflow/system-d1-proposal-query.repository"
import { SystemD1WorkflowWriter } from "@system/infrastructure/workflow/system-d1-workflow-writer.repository"

export type SystemApplicationResult = Readonly<{
  proposal: SystemProposalView
  applicantName: string
  approverRoles: ReadonlyArray<string>
}>

export function systemProposalQuery(c: Context): SystemD1ProposalQuery {
  return new SystemD1ProposalQuery({ env: { DB: c.env.DB } })
}

export async function submitSystemApplication(
  c: Context,
  input: Readonly<{
    applicantId: number
    templateCode: string
    payload: unknown
    createdAt: Date
  }>,
): Promise<SystemApplicationResult | ApplicationError> {
  const definition = await loadSystemProcedure(c, input.templateCode)
  if (definition instanceof Error) {
    return new UnexpectedError("failed to find application template", { cause: definition })
  }
  if (definition === null) return new NotFoundError("template not found", "template_not_found")
  if (definition.completionOperationKey !== null) {
    return new UnprocessableError(
      "system template requires its dedicated request route",
      "system_template_requires_dedicated_route",
    )
  }
  const schema = parseSystemProcedureInputSchema(definition)
  const policy = parseSystemProcedurePolicy(definition)
  if (schema instanceof Error || policy instanceof Error) {
    return new UnexpectedError("invalid application template")
  }

  return startSystemApplication(c, {
    applicantId: input.applicantId,
    schema: schema.value,
    policy,
    procedureKey: definition.key,
    procedureRevision: definition.revision,
    payload: input.payload,
    createdAt: input.createdAt,
    seriesId: crypto.randomUUID(),
    version: 1,
    supersedesProposalId: null,
  })
}

export async function reviseSystemApplication(
  c: Context,
  input: Readonly<{
    number: number
    applicantId: number
    payload: unknown
    revisedAt: Date
    mode: "edit" | "resubmit"
  }>,
): Promise<SystemApplicationResult | ApplicationError> {
  const current = await systemProposalQuery(c).findByNumber(input.number)
  if (current instanceof Error) {
    return new UnexpectedError("failed to find application", { cause: current })
  }
  if (current === null) return new NotFoundError("application not found", "application_not_found")
  const participant = await resolveActiveCompanyAccountParticipant(c, current.createdByAccountId)
  if (participant instanceof Error) {
    return new UnexpectedError("failed to resolve application owner", { cause: participant })
  }
  if (participant === null || participant.employeeId !== input.applicantId) {
    return new ForbiddenError("not the applicant", "not_applicant")
  }
  const policy = parseJsonPolicy(current.decisionPolicyJson)
  const schema = parseJsonValue(current.inputSchemaJson)
  if (policy instanceof Error || schema instanceof Error) {
    return new UnexpectedError("invalid application procedure")
  }
  if (current.completionOperationKey !== null) {
    return new ConflictError(
      "system application must use its dedicated route",
      "system_template_requires_dedicated_route",
    )
  }
  if (input.mode === "edit") {
    if (current.status !== "pending") {
      return new ConflictError("application is already decided", "not_pending")
    }
    if (policy.workflow !== null) {
      return new ConflictError(
        "workflow application can only be edited when resubmitting a return",
        "workflow_locked",
      )
    }
  } else if (current.status !== "returned" || policy.workflow === null) {
    return new ConflictError("application is not returned", "not_returned")
  }

  return startSystemApplication(c, {
    applicantId: input.applicantId,
    schema: schema.value,
    policy,
    procedureKey: current.procedureKey,
    procedureRevision: current.procedureRevision,
    payload: input.payload,
    createdAt: input.revisedAt,
    seriesId: current.seriesId,
    version: current.version + 1,
    supersedesProposalId: current.proposalId,
  })
}

export async function withdrawSystemApplication(
  c: Context,
  input: Readonly<{ number: number; applicantId: number; withdrawnAt: Date }>,
): Promise<true | ApplicationError> {
  const current = await systemProposalQuery(c).findByNumber(input.number)
  if (current instanceof Error) {
    return new UnexpectedError("failed to find application", { cause: current })
  }
  if (current === null) return new NotFoundError("application not found", "application_not_found")
  const participant = await resolveActiveCompanyAccountParticipant(c, current.createdByAccountId)
  if (participant instanceof Error) {
    return new UnexpectedError("failed to resolve application owner", { cause: participant })
  }
  if (participant === null || participant.employeeId !== input.applicantId) {
    return new ForbiddenError("not the applicant", "not_applicant")
  }
  if (current.completionOperationKey !== null) {
    return new ConflictError(
      "system application must use its dedicated withdrawal route",
      "system_template_requires_dedicated_route",
    )
  }
  const result = await new CancelSystemProcedure(
    new SystemD1WorkflowWriter({ env: { DB: c.env.DB } }),
  ).run({
    number: input.number,
    createdByAccountId: current.createdByAccountId,
    cancelledAt: input.withdrawnAt,
  })
  if (result === "not_found") {
    return new NotFoundError("application not found", "application_not_found")
  }
  if (result === "not_pending") {
    return new ConflictError("application is already decided", "not_pending")
  }
  return result instanceof Error
    ? new UnexpectedError("failed to withdraw application", { cause: result })
    : true
}

export async function decideSystemApplication(
  c: Context,
  input: Readonly<{
    number: number
    actorEmployeeId: number
    action: "approve" | "reject"
    comment: string | null
    decidedAt: Date
  }>,
): Promise<Readonly<{ status: "pending" | "approved" | "rejected" }> | ApplicationError> {
  const query = systemProposalQuery(c)
  const proposal = await query.findByNumber(input.number)
  if (proposal instanceof Error) {
    return new UnexpectedError("failed to find application", { cause: proposal })
  }
  if (proposal === null || proposal.status === "cancelled") {
    return new NotFoundError("application not found", "application_not_found")
  }
  if (
    input.action === "approve" &&
    (proposal.status === "approved" || proposal.status === "executed")
  ) {
    const completed = await completeSystemApplicationIfRequired(c, proposal, input.decidedAt)
    return completed instanceof ApplicationError ? completed : { status: "approved" }
  }
  if (
    proposal.status !== "pending" ||
    proposal.currentTaskKey === null ||
    proposal.currentTaskRound === null
  ) {
    return new ConflictError("application is already decided", "already_decided")
  }
  const session = c.var.session
  if (session === null || session.employeeId !== input.actorEmployeeId) {
    return new ForbiddenError("cannot decide as another employee", "forbidden")
  }
  const actorAccountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (actorAccountId instanceof Error) {
    return new UnexpectedError("failed to resolve canonical workflow actor", {
      cause: actorAccountId,
    })
  }
  const actor = await resolveActiveCompanyAccountParticipant(c, actorAccountId)
  if (actor instanceof Error) {
    return new UnexpectedError("failed to resolve Company workflow actor", { cause: actor })
  }
  if (actor === null || actor.employeeId !== input.actorEmployeeId) {
    return new ForbiddenError("workflow actor is not active", "forbidden")
  }
  const candidateAccountIds = await query.listTaskCandidateAccountIds({
    caseId: proposal.caseId,
    taskKey: proposal.currentTaskKey,
    round: proposal.currentTaskRound,
    at: input.decidedAt,
  })
  if (candidateAccountIds instanceof Error) {
    return new UnexpectedError("failed to load decision candidates", {
      cause: candidateAccountIds,
    })
  }
  const policy = parseJsonPolicy(proposal.decisionPolicyJson)
  const payload = parseJsonValue(proposal.bodyJson)
  if (policy instanceof Error || payload instanceof Error) {
    return new UnexpectedError("invalid application procedure")
  }
  const step = policy.workflow?.steps.find((candidate) => candidate.key === proposal.currentTaskKey)
  let representedAccountId = actorAccountId
  let delegationId: string | null = null
  if (!candidateAccountIds.includes(actorAccountId)) {
    if (step?.allow_delegation === false) {
      return new ForbiddenError("workflow step does not allow delegation", "forbidden")
    }
    const delegation = await query.findDelegation({
      caseId: proposal.caseId,
      actorAccountId,
      candidateAccountIds,
      at: input.decidedAt,
    })
    if (delegation instanceof Error) {
      return new UnexpectedError("failed to resolve delegation", { cause: delegation })
    }
    if (delegation === null) {
      return new ForbiddenError("not eligible to decide application", "forbidden")
    }
    representedAccountId = delegation.representedAccountId
    delegationId = delegation.id
  }
  const represented = await resolveActiveCompanyAccountParticipant(c, representedAccountId)
  if (represented instanceof Error) {
    return new UnexpectedError("failed to revalidate Company decision authority", {
      cause: represented,
    })
  }
  if (represented === null) {
    return new ForbiddenError("decision authority is no longer active", "forbidden")
  }
  const applicantParticipant = await resolveActiveCompanyAccountParticipant(
    c,
    proposal.createdByAccountId,
  )
  if (applicantParticipant instanceof Error || applicantParticipant === null) {
    return new UnexpectedError("failed to resolve workflow applicant", {
      cause: applicantParticipant instanceof Error ? applicantParticipant : undefined,
    })
  }
  const applicant = await new EmployeeRepository(c).findById(applicantParticipant.employeeId)
  if (applicant instanceof Error || applicant === null) {
    return new UnexpectedError("failed to load workflow applicant", {
      cause: applicant instanceof Error ? applicant : undefined,
    })
  }
  const systemAction =
    input.action === "reject" && step?.rejection_behavior === "return" ? "return" : input.action
  let nextTask = null
  if (systemAction === "approve") {
    let authoritySubjectEmployeeId: number | null | undefined
    let targetDepartmentCode: string | null | undefined
    let excludedEmployeeIds: ReadonlySet<number> | undefined
    if (proposal.completionOperationKey === "company.personnel-action.apply") {
      const personnelRequest = await findPersonnelActionRequest(c, session, {
        applicationId: proposal.number,
      })
      if (personnelRequest instanceof ApplicationError) return personnelRequest
      if (personnelRequest === null) {
        return new UnexpectedError("Company personnel action association is missing")
      }
      authoritySubjectEmployeeId = personnelRequest.targetEmployeeId
      targetDepartmentCode = personnelRequest.targetDepartmentCode
      excludedEmployeeIds = new Set(
        personnelRequest.targetEmployeeId === null
          ? [personnelRequest.requestedByEmployeeId]
          : [personnelRequest.requestedByEmployeeId, personnelRequest.targetEmployeeId],
      )
    }
    const next = await resolveCompanyProcedureTask({
      c,
      policy,
      payload: payload.value,
      applicant: {
        id: applicant.id,
        code: applicant.code,
        dept_id: applicant.deptId,
        dept_name: applicant.deptName,
        position: applicant.position,
        status: applicant.status,
      },
      activatedAt: input.decidedAt,
      afterTaskKey: proposal.currentTaskKey,
      authoritySubjectEmployeeId,
      targetDepartmentCode,
      excludedEmployeeIds,
    })
    if (next instanceof Error) {
      return new UnprocessableError(
        "next workflow step cannot be resolved",
        "workflow_unresolvable",
        { cause: next },
      )
    }
    if (next !== null) {
      const caseId = systemCaseIdSchema.safeParse(proposal.caseId)
      if (!caseId.success) return new UnexpectedError("invalid System Case ID")
      const persistence = createSystemDecisionTask({
        task: next.task,
        caseId: caseId.data,
        createdByAccountId: proposal.createdByAccountId,
        proposalDigest: proposal.digest,
      })
      if (persistence instanceof Error) {
        return new UnexpectedError("invalid next System Task", { cause: persistence })
      }
      nextTask = persistence
    }
  }
  const caseId = systemCaseIdSchema.safeParse(proposal.caseId)
  if (!caseId.success) return new UnexpectedError("invalid System Case ID")
  const result = await new DecideSystemTask(
    new SystemD1WorkflowWriter({ env: { DB: c.env.DB } }),
  ).run({
    caseId: caseId.data,
    taskKey: proposal.currentTaskKey,
    round: proposal.currentTaskRound,
    actorAccountId,
    representedAccountId,
    delegationId,
    action: systemAction,
    proposalDigest: proposal.digest,
    comment: input.comment,
    decidedAt: input.decidedAt,
    nextTask,
  })
  if (result instanceof Error) {
    if (
      isUniqueConstraintError(result) ||
      // System の SQL trigger メッセージ依存。System 側で判別子化するまでの暫定。
      result.message.includes("invalid human attestation")
    ) {
      return new ConflictError("application is already decided", "already_decided")
    }
    return new UnexpectedError("failed to decide System application", { cause: result })
  }

  if (result.caseStatus === "approved") {
    const completed = await completeSystemApplicationIfRequired(c, proposal, input.decidedAt)
    if (completed instanceof ApplicationError) return completed
    return { status: "approved" }
  }

  return { status: result.caseStatus === "rejected" ? "rejected" : "pending" }
}

async function completeSystemApplicationIfRequired(
  c: Context,
  proposal: SystemProposalView,
  completedAt: Date,
): Promise<true | ApplicationError> {
  if (proposal.completionOperationKey === null) return true
  if (proposal.completionOperationKey !== "company.personnel-action.apply") {
    return new UnexpectedError("unknown System completion operation")
  }
  const session = c.var.session
  if (session === null) return new UnexpectedError("authenticated session is missing")
  const completed = await new CompleteApprovedPersonnelActionRequest(c).run({
    applicationId: proposal.number,
    session,
    completedAt,
  })
  return completed instanceof ApplicationError ? completed : true
}

export async function reassignSystemApplicationTask(
  c: Context,
  input: Readonly<{
    number: number
    candidateEmployeeIds: ReadonlyArray<number>
    requiredApprovals: number | undefined
    reason: string
    reassignedAt: Date
  }>,
): Promise<
  | Readonly<{
      status: "pending"
      stepKey: string
      round: number
      candidateEmployeeIds: ReadonlyArray<number>
    }>
  | ApplicationError
> {
  const session = c.var.session
  if (session === null || !canRepairWorkflow(session)) {
    return new ForbiddenError("cannot repair application workflows", "forbidden")
  }
  const query = systemProposalQuery(c)
  const proposal = await query.findByNumber(input.number)
  if (proposal instanceof Error) {
    return new UnexpectedError("failed to load application", { cause: proposal })
  }
  if (proposal === null || proposal.status === "cancelled") {
    return new NotFoundError("application not found", "application_not_found")
  }
  if (
    proposal.status !== "pending" ||
    proposal.currentTaskKey === null ||
    proposal.currentTaskRound === null
  ) {
    return new ConflictError("workflow is not pending", "already_decided")
  }
  const policy = parseJsonPolicy(proposal.decisionPolicyJson)
  if (policy instanceof Error || policy.workflow === null) {
    return new NotFoundError("workflow instance not found", "workflow_not_found")
  }
  const applicant = await resolveActiveCompanyAccountParticipant(c, proposal.createdByAccountId)
  if (applicant instanceof Error || applicant === null) {
    return new UnexpectedError("failed to resolve application owner", {
      cause: applicant instanceof Error ? applicant : undefined,
    })
  }
  const candidateEmployeeIds = [...new Set(input.candidateEmployeeIds)]
  if (
    candidateEmployeeIds.length === 0 ||
    candidateEmployeeIds.includes(applicant.employeeId) ||
    candidateEmployeeIds.includes(session.employeeId)
  ) {
    return new UnprocessableError("applicant cannot be the repair approver", "invalid_candidate")
  }
  const tasks = await query.listTasks(proposal.caseId)
  if (tasks instanceof Error) {
    return new UnexpectedError("failed to load workflow task", { cause: tasks })
  }
  const currentTask = tasks.find(
    (task) => task.key === proposal.currentTaskKey && task.round === proposal.currentTaskRound,
  )
  if (currentTask === undefined) return new UnexpectedError("current System Task is missing")
  const requiredApprovals = input.requiredApprovals ?? currentTask.requiredApprovals
  if (requiredApprovals !== currentTask.requiredApprovals) {
    return new UnprocessableError(
      "required approvals must preserve the frozen quorum",
      "workflow_quorum_mismatch",
    )
  }
  if (candidateEmployeeIds.length < requiredApprovals) {
    return new UnprocessableError(
      "repair candidates cannot satisfy the frozen quorum",
      "workflow_unresolvable",
    )
  }
  const accountIds = await resolveSystemAccountIdsForEmployees(c, candidateEmployeeIds)
  if (accountIds instanceof Error) {
    return new UnexpectedError("failed to resolve repair candidate accounts", {
      cause: accountIds,
    })
  }
  const participants = await resolveCompanyAccountParticipants(c, accountIds)
  if (participants instanceof Error) {
    return new UnexpectedError("failed to resolve repair candidates", { cause: participants })
  }
  const liveParticipants = participants.filter(
    (participant) => participant.status === "active" && participant.archivedAt === null,
  )
  const resolvedEmployeeIds = new Set(liveParticipants.map((participant) => participant.employeeId))
  if (candidateEmployeeIds.some((employeeId) => !resolvedEmployeeIds.has(employeeId))) {
    return new UnprocessableError(
      "a repair candidate has no active account",
      "workflow_unresolvable",
    )
  }
  const actorAccountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (actorAccountId instanceof Error) {
    return new UnexpectedError("failed to resolve canonical workflow actor", {
      cause: actorAccountId,
    })
  }
  const resolutionId = crypto.randomUUID()
  const candidates: StartSystemProcedureTask["candidates"][number][] = []
  for (const participant of liveParticipants) {
    const evidence = CanonicalSystemJsonValue.create({
      actorAccountId,
      candidateAccountId: participant.accountId,
      candidateEmployeeId: participant.employeeId,
      reason: input.reason,
      reassignedAt: input.reassignedAt.toISOString(),
    })
    if (evidence instanceof Error) {
      return new UnexpectedError("failed to canonicalize repair evidence", { cause: evidence })
    }
    const digest = await ProposalDigestValue.create(evidence)
    if (digest instanceof Error) {
      return new UnexpectedError("failed to digest repair evidence", { cause: digest })
    }
    candidates.push({
      accountId: participant.accountId,
      source: "primary",
      evidenceContext: "company",
      evidenceKind: "manual-workflow-repair",
      evidenceId: resolutionId,
      evidenceVersion: input.reassignedAt.toISOString(),
      eligibilityDigest: digest.toString(),
      eligibleFrom: null,
      resolvedAt: input.reassignedAt,
    })
  }
  const caseId = systemCaseIdSchema.safeParse(proposal.caseId)
  if (!caseId.success) return new UnexpectedError("invalid System Case ID")
  const round = proposal.currentTaskRound + 1
  const replacement = createSystemDecisionTask({
    task: {
      key: proposal.currentTaskKey,
      requiredApprovals,
      openedAt: input.reassignedAt,
      dueAt: null,
      candidates,
      excludedAccountIds: [actorAccountId],
    },
    caseId: caseId.data,
    createdByAccountId: proposal.createdByAccountId,
    proposalDigest: proposal.digest,
    round,
  })
  if (replacement instanceof Error) {
    return new UnprocessableError("invalid workflow repair", "invalid_candidate", {
      cause: replacement,
    })
  }
  const result = await new SystemD1WorkflowWriter({ env: { DB: c.env.DB } }).reassign({
    caseId: proposal.caseId,
    taskKey: proposal.currentTaskKey,
    round: proposal.currentTaskRound,
    reassignedAt: input.reassignedAt,
    replacement,
  })
  if (result === "not_pending") {
    return new ConflictError("workflow is not repairable", "workflow_not_repairable")
  }
  if (result instanceof Error) {
    return new UnexpectedError("failed to reassign workflow", { cause: result })
  }

  return { status: "pending", stepKey: proposal.currentTaskKey, round, candidateEmployeeIds }
}

async function startSystemApplication(
  c: Context,
  input: Readonly<{
    applicantId: number
    schema: unknown
    policy: CompanyProcedureDecisionPolicy
    procedureKey: string
    procedureRevision: number
    payload: unknown
    createdAt: Date
    seriesId: string
    version: number
    supersedesProposalId: string | null
  }>,
): Promise<SystemApplicationResult | ApplicationError> {
  const payload = validateAndNormalizeApplicationPayload(input.schema, input.payload)
  if (payload instanceof Error) {
    return new UnprocessableError("payload does not match template schema", "invalid_payload", {
      cause: payload,
    })
  }
  const applicant = await new EmployeeRepository(c).findById(input.applicantId)
  if (applicant instanceof Error) {
    return new UnexpectedError("failed to find applicant", { cause: applicant })
  }
  if (applicant === null) return new UnexpectedError("applicant not found")
  const session = c.var.session
  if (session === null) return new UnexpectedError("authenticated session is missing")
  const accountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (accountId instanceof Error) {
    return new UnexpectedError("failed to resolve canonical applicant", { cause: accountId })
  }
  const participant = await resolveActiveCompanyAccountParticipant(c, accountId)
  if (participant instanceof Error) {
    return new UnexpectedError("failed to resolve Company applicant", { cause: participant })
  }
  if (participant === null || participant.employeeId !== input.applicantId) {
    return new ForbiddenError("cannot submit as another employee", "forbidden")
  }
  const resolvedTask = await resolveCompanyProcedureTask({
    c,
    policy: input.policy,
    payload,
    applicant: {
      id: applicant.id,
      code: applicant.code,
      dept_id: applicant.deptId,
      dept_name: applicant.deptName,
      position: applicant.position,
      status: applicant.status,
    },
    activatedAt: input.createdAt,
    afterTaskKey: null,
  })
  if (resolvedTask instanceof Error || resolvedTask === null) {
    return new UnprocessableError(
      "application workflow has no eligible decision step",
      "workflow_unresolvable",
      { cause: resolvedTask instanceof Error ? resolvedTask : undefined },
    )
  }
  const started = await new StartSystemProcedure(
    new SystemD1WorkflowWriter({ env: { DB: c.env.DB } }),
  ).run({
    seriesId: input.seriesId,
    version: input.version,
    procedureKey: input.procedureKey,
    procedureRevision: input.procedureRevision,
    body: payload,
    createdByAccountId: accountId,
    supersedesProposalId: input.supersedesProposalId,
    createdAt: input.createdAt,
    firstTask: resolvedTask.task,
  })
  if (started instanceof Error) {
    return new UnexpectedError("failed to start System procedure", { cause: started })
  }
  const proposal = await systemProposalQuery(c).findByNumber(started.number)
  if (proposal instanceof Error || proposal === null) {
    return new UnexpectedError("failed to read submitted System proposal", {
      cause: proposal instanceof Error ? proposal : undefined,
    })
  }

  return {
    proposal,
    applicantName: applicant.name,
    approverRoles: input.policy.approverRoles,
  }
}

function parseJsonPolicy(value: string) {
  const parsed = parseJsonValue(value)
  return parsed instanceof Error ? parsed : parseCompanyProcedureDecisionPolicy(parsed.value)
}
