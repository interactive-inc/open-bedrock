import type { Session } from "@/domain/company/iam/session"
import type { ApplicationWorkflowStep } from "@/domain/application/application-workflow"
import type { Context } from "@/env"
import { prepareApplicationCompletion } from "@/application/application/application-completion-registry"
import {
  ApplicationWorkflowRepository,
  type WorkflowInstance,
  type WorkflowStepSnapshot,
} from "@/infrastructure/application/application-workflow-repository"
import { WorkflowSql } from "@/infrastructure/application/workflow-sql"
import { workflowValidApprovalCountSql } from "@/infrastructure/application/workflow-valid-approval-count-sql"
import { workflowValidApprovalsSql } from "@/infrastructure/application/workflow-valid-approvals-sql"
import { resolveRepresentedApprover } from "@/lib/application/resolve-represented-approver"
import { loadOrResolveWorkflowStepSnapshot } from "@/lib/application/load-or-resolve-workflow-step-snapshot"
import { persistResolvedWorkflowStepSnapshot } from "@/lib/application/persist-resolved-workflow-step-snapshot"
import { ensureWorkflowStepEscalation } from "@/lib/application/ensure-workflow-step-escalation"
import { resolveWorkflowStepSnapshot } from "@/lib/application/resolve-workflow-step-snapshot"
import { UnresolvableWorkflowStepError } from "@/lib/application/unresolvable-workflow-step-error"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/d1/is-aborted-by-guard"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import {
  applicableWorkflowSteps,
  type WorkflowApplicant,
} from "@/lib/application/applicable-workflow-steps"

export type WorkflowDecision = { status: "pending" | "approved" | "rejected" }

export async function decideWorkflowApplication(props: {
  c: Context
  instance: WorkflowInstance
  templateCode: string
  applicantEmployeeId: number
  applicant: WorkflowApplicant
  payload: unknown
  actorEmployeeId: number
  actorAccountId: number
  session: Session
  action: "approve" | "reject"
  comment: string | null
  createdAt: string
}): Promise<WorkflowDecision | ApplicationError> {
  const currentIndex = props.instance.definition.steps.findIndex(
    (step) => step.key === props.instance.currentStepKey,
  )
  const step = props.instance.definition.steps[currentIndex]

  if (step === undefined) {
    return new UnexpectedError("workflow current step is invalid")
  }

  const resolutionContext = await loadWorkflowResolutionContext({
    c: props.c,
    applicationId: props.instance.applicationId,
    applicantEmployeeId: props.applicantEmployeeId,
  })
  if (resolutionContext instanceof Error) {
    return new UnexpectedError("failed to load workflow subject", { cause: resolutionContext })
  }

  const loadedSnapshot = await loadOrResolveWorkflowStepSnapshot({
    c: props.c,
    instance: props.instance,
    applicantEmployeeId: resolutionContext.employeeId,
    step,
    now: props.createdAt,
    excludedEmployeeIds: resolutionContext.excludedEmployeeIds,
    targetDepartmentCode: resolutionContext.targetDepartmentCode,
  })

  if (loadedSnapshot instanceof Error) {
    return loadedSnapshot instanceof UnresolvableWorkflowStepError
      ? new ConflictError(loadedSnapshot.message, "workflow_unresolvable")
      : new UnexpectedError("failed to load workflow step snapshot", { cause: loadedSnapshot })
  }

  let stepSnapshot = loadedSnapshot.snapshot
  if (loadedSnapshot.persisted) {
    const escalated = await ensureWorkflowStepEscalation({
      c: props.c,
      snapshot: stepSnapshot,
      now: props.createdAt,
    })
    if (escalated instanceof Error) {
      return new UnexpectedError("failed to activate workflow escalation", { cause: escalated })
    }
    stepSnapshot = escalated
  }
  let authorization = await resolveStepAuthorization({ ...props, step, stepSnapshot })

  if (authorization instanceof Error) {
    return new UnexpectedError("failed to resolve workflow delegation", {
      cause: authorization,
    })
  }

  if (authorization === null || props.actorEmployeeId === props.applicantEmployeeId) {
    return new ForbiddenError("cannot decide this workflow step", "forbidden")
  }

  if (loadedSnapshot.persisted === false) {
    const persisted = await persistResolvedWorkflowStepSnapshot({
      c: props.c,
      snapshot: stepSnapshot,
    })
    if (persisted instanceof Error) {
      return new UnexpectedError("failed to persist workflow step snapshot", { cause: persisted })
    }

    const escalated = await ensureWorkflowStepEscalation({
      c: props.c,
      snapshot: persisted,
      now: props.createdAt,
    })
    if (escalated instanceof Error) {
      return new UnexpectedError("failed to activate workflow escalation", { cause: escalated })
    }

    stepSnapshot = escalated
    authorization = await resolveStepAuthorization({ ...props, step, stepSnapshot })
    if (authorization instanceof Error) {
      return new UnexpectedError("failed to resolve workflow delegation", {
        cause: authorization,
      })
    }
    if (authorization === null) {
      return new ForbiddenError("cannot decide this workflow step", "forbidden")
    }
  }

  if (props.action === "reject") {
    return rejectStep({
      ...props,
      step,
      representedApprover: authorization.employeeId,
      delegationId: authorization.delegationId,
    })
  }

  const applicableSteps = applicableWorkflowSteps({
    workflow: props.instance.definition,
    payload: props.payload,
    applicant: props.applicant,
  })
  const applicableKeys = new Set(applicableSteps.map((candidate) => candidate.key))
  const nextStep = props.instance.definition.steps
    .slice(currentIndex + 1)
    .find((candidate) => applicableKeys.has(candidate.key))

  return persistApproval({
    ...props,
    step,
    representedApprover: authorization.employeeId,
    delegationId: authorization.delegationId,
    nextStep,
    requiredApprovals: stepSnapshot.requiredApprovals,
    workflowSubjectEmployeeId: resolutionContext.employeeId,
    excludedEmployeeIds: resolutionContext.excludedEmployeeIds,
    targetDepartmentCode: resolutionContext.targetDepartmentCode,
  })
}

type WorkflowResolutionContext = {
  employeeId: number | null
  excludedEmployeeIds: ReadonlySet<number> | undefined
  targetDepartmentCode: string | null
}

async function loadWorkflowResolutionContext(props: {
  c: Context
  applicationId: number
  applicantEmployeeId: number
}): Promise<WorkflowResolutionContext | Error> {
  try {
    const subject = await props.c.env.DB.prepare(
      `SELECT subject_type, subject_employee_id, target_department_code
       FROM application_subjects WHERE application_id = ?1`,
    )
      .bind(props.applicationId)
      .first<{
        subject_type: string
        subject_employee_id: number | null
        target_department_code: string | null
      }>()

    if (subject?.subject_type === "prospective_employee") {
      return {
        employeeId: null,
        excludedEmployeeIds: new Set([props.applicantEmployeeId]),
        targetDepartmentCode: subject.target_department_code,
      }
    }

    if (subject?.subject_type !== "employee" || subject.subject_employee_id === null) {
      return {
        employeeId: props.applicantEmployeeId,
        excludedEmployeeIds: undefined,
        targetDepartmentCode: null,
      }
    }

    return {
      employeeId: subject.subject_employee_id,
      excludedEmployeeIds: new Set([props.applicantEmployeeId, subject.subject_employee_id]),
      targetDepartmentCode: subject.target_department_code,
    }
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to load workflow subject")
  }
}

async function resolveStepAuthorization(props: {
  c: Context
  actorEmployeeId: number
  actorAccountId: number
  session: Session
  templateCode: string
  createdAt: string
  step: ApplicationWorkflowStep
  stepSnapshot: WorkflowStepSnapshot
}) {
  const eligibleCandidates = props.stepSnapshot.candidates.filter(
    (candidate) => candidate.source === "primary" || props.stepSnapshot.escalatedAt !== null,
  )
  const recordedApprovers = await loadRecordedApprovers({
    c: props.c,
    instance: {
      applicationId: props.stepSnapshot.applicationId,
      definition: { version: 1, steps: [props.step] },
      currentStepKey: props.stepSnapshot.stepKey,
      currentRound: props.stepSnapshot.round,
      startedAt: props.stepSnapshot.activatedAt,
      dueAt: props.stepSnapshot.dueAt,
    },
    step: props.step,
  })

  if (recordedApprovers instanceof Error) return recordedApprovers

  return resolveRepresentedApprover({
    c: props.c,
    actorEmployeeId: props.actorEmployeeId,
    actorAccountId: props.actorAccountId,
    candidateAccounts: eligibleCandidates.map((candidate) => ({
      employeeId: candidate.employeeId,
      accountId: candidate.accountId,
    })),
    templateCode: props.templateCode,
    now: props.createdAt,
    allowDelegation: props.step.allow_delegation,
    excludedEmployeeIds: recordedApprovers,
  })
}

async function persistApproval(props: {
  c: Context
  instance: WorkflowInstance
  templateCode: string
  applicantEmployeeId: number
  actorEmployeeId: number
  actorAccountId: number
  session: Session
  representedApprover: number
  delegationId: number | null
  comment: string | null
  createdAt: string
  step: ApplicationWorkflowStep
  nextStep: ApplicationWorkflowStep | undefined
  requiredApprovals: number
  workflowSubjectEmployeeId: number | null
  excludedEmployeeIds: ReadonlySet<number> | undefined
  targetDepartmentCode: string | null
}): Promise<WorkflowDecision | ApplicationError> {
  const insert = approvalInsert(props, "approve")

  const completion =
    props.nextStep === undefined
      ? await prepareApplicationCompletion({
          c: props.c,
          applicationId: props.instance.applicationId,
          session: props.session,
        })
      : null

  if (completion instanceof Error) return completion

  const nextStepSnapshot =
    props.nextStep === undefined
      ? null
      : await resolveWorkflowStepSnapshot({
          c: props.c,
          applicantEmployeeId: props.workflowSubjectEmployeeId,
          step: props.nextStep,
          activatedAt: props.createdAt,
          excludedEmployeeIds: props.excludedEmployeeIds,
          targetDepartmentCode: props.targetDepartmentCode,
        })

  if (nextStepSnapshot instanceof Error) {
    return nextStepSnapshot instanceof UnresolvableWorkflowStepError
      ? persistApprovalBeforeUnresolvableNextStep({
          ...props,
          insert,
          resolutionError: nextStepSnapshot,
        })
      : new UnexpectedError("failed to resolve next workflow step", { cause: nextStepSnapshot })
  }

  const nextStepRound =
    props.nextStep === undefined
      ? null
      : await new ApplicationWorkflowRepository(props.c).findNextStepRound(
          props.instance.applicationId,
          props.nextStep.key,
        )

  if (nextStepRound instanceof Error) {
    return new UnexpectedError("failed to resolve next workflow step round", {
      cause: nextStepRound,
    })
  }

  try {
    const nextStep = props.nextStep

    if (nextStep === undefined) {
      if (completion !== null) {
        return persistFinalApprovalWithCompletion({ ...props, insert, completion })
      }

      const results = await props.c.env.DB.batch([
        insert,
        abortWhenPreviousStatementChangedNoRows(props.c.env.DB),
        props.c.env.DB.prepare(
          `UPDATE application_requests
             SET status = 'approved', current_step = NULL
             WHERE id = ?1 AND status = 'pending' AND current_step = ?2
               AND (${workflowValidApprovalCountSql({
                 applicationId: "?1",
                 stepKey: "?2",
                 round: "?3",
               })}) >= ?4
             RETURNING status`,
        ).bind(
          props.instance.applicationId,
          props.step.key,
          props.instance.currentRound,
          props.requiredApprovals,
        ),
      ])

      if ((results.at(2)?.results.length ?? 0) === 1) return { status: "approved" }
      if ((results.at(0)?.results.length ?? 0) === 1) return { status: "pending" }

      return new ConflictError("workflow step already changed", "already_decided")
    }

    if (nextStepSnapshot === null || nextStepRound === null) {
      return new UnexpectedError("next workflow step snapshot is missing")
    }

    const results = await props.c.env.DB.batch([
      insert,
      abortWhenPreviousStatementChangedNoRows(props.c.env.DB),
      ...new WorkflowSql(props.c.env.DB).conditionalInsert({
        applicationId: props.instance.applicationId,
        stepKey: nextStep.key,
        round: nextStepRound,
        snapshot: nextStepSnapshot,
        currentStepKey: props.step.key,
        currentRound: props.instance.currentRound,
        requiredApprovals: props.requiredApprovals,
      }),
      props.c.env.DB.prepare(
        `UPDATE application_workflow_instances
           SET current_step_key = ?2, current_round = ?3, started_at = ?4, due_at = ?5
           WHERE application_id = ?1 AND current_step_key = ?6 AND current_round = ?7
             AND (${workflowValidApprovalCountSql({
               applicationId: "?1",
               stepKey: "?6",
               round: "?7",
             })}) >= ?8
           RETURNING current_step_key`,
      ).bind(
        props.instance.applicationId,
        nextStep.key,
        nextStepRound,
        props.createdAt,
        nextStepSnapshot.dueAt,
        props.step.key,
        props.instance.currentRound,
        props.requiredApprovals,
      ),
      props.c.env.DB.prepare(
        `UPDATE application_requests
           SET current_step = ?2
           WHERE id = ?1 AND status = 'pending' AND current_step = ?3
             AND EXISTS (
               SELECT 1 FROM application_workflow_instances
               WHERE application_id = ?1 AND current_step_key = ?2 AND current_round = ?4
             )
           RETURNING current_step`,
      ).bind(props.instance.applicationId, nextStep.key, props.step.key, nextStepRound),
      workflowTransitionConsistencyGuard({
        db: props.c.env.DB,
        applicationId: props.instance.applicationId,
        previousStepKey: props.step.key,
        previousRound: props.instance.currentRound,
        nextStepKey: nextStep.key,
        nextRound: nextStepRound,
      }),
    ])

    const applicationUpdate = results.at(-2)
    if ((applicationUpdate?.results.length ?? 0) === 1) return { status: "pending" }
    if ((results.at(0)?.results.length ?? 0) === 1) return { status: "pending" }

    return new ConflictError("workflow step already changed", "already_decided")
  } catch (error) {
    return isAbortedByGuard(error)
      ? new ConflictError("workflow step already changed", "already_decided")
      : new UnexpectedError("failed to persist workflow approval", { cause: error })
  }
}

async function persistFinalApprovalWithCompletion(props: {
  c: Context
  instance: WorkflowInstance
  actorEmployeeId: number
  step: ApplicationWorkflowStep
  requiredApprovals: number
  insert: D1PreparedStatement
  completion: { actionId: string; statements: ReadonlyArray<D1PreparedStatement> }
}): Promise<WorkflowDecision | ApplicationError> {
  // A completion batch is attempted first. If this vote does not reach quorum, its
  // approval insert is rolled back and a second guarded batch stores it as a partial
  // approval. If another voter reaches quorum between those batches, retry completion.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await props.c.env.DB.batch([
        props.insert,
        abortWhenPreviousStatementChangedNoRows(props.c.env.DB),
        props.c.env.DB.prepare(
          `UPDATE application_requests
               SET status = 'approved', current_step = NULL
             WHERE id = ?1 AND status = 'pending' AND current_step = ?2
               AND (${workflowValidApprovalCountSql({
                 applicationId: "?1",
                 stepKey: "?2",
                 round: "?3",
               })}) >= ?4
             RETURNING status`,
        ).bind(
          props.instance.applicationId,
          props.step.key,
          props.instance.currentRound,
          props.requiredApprovals,
        ),
        abortWhenPreviousStatementChangedNoRows(props.c.env.DB),
        ...props.completion.statements,
      ])
      return { status: "approved" }
    } catch (error) {
      if (!isAbortedByGuard(error)) {
        return new UnexpectedError("failed to complete workflow application", { cause: error })
      }
    }

    try {
      await props.c.env.DB.batch([
        props.insert,
        abortWhenPreviousStatementChangedNoRows(props.c.env.DB),
        props.c.env.DB.prepare(
          `SELECT CASE WHEN (${workflowValidApprovalCountSql({
            applicationId: "?1",
            stepKey: "?2",
            round: "?3",
          })}) < ?4 THEN 1 ELSE json_extract('', '$') END AS ok`,
        ).bind(
          props.instance.applicationId,
          props.step.key,
          props.instance.currentRound,
          props.requiredApprovals,
        ),
      ])
      return { status: "pending" }
    } catch (error) {
      if (!isAbortedByGuard(error)) {
        return new UnexpectedError("failed to persist workflow approval", { cause: error })
      }
    }
  }

  return new ConflictError("workflow step already changed", "already_decided")
}

async function persistApprovalBeforeUnresolvableNextStep(props: {
  c: Context
  instance: WorkflowInstance
  actorEmployeeId: number
  step: ApplicationWorkflowStep
  requiredApprovals: number
  insert: D1PreparedStatement
  resolutionError: UnresolvableWorkflowStepError
}): Promise<WorkflowDecision | ApplicationError> {
  try {
    await props.c.env.DB.batch([
      props.insert,
      abortWhenPreviousStatementChangedNoRows(props.c.env.DB),
      props.c.env.DB.prepare(
        `SELECT CASE WHEN (${workflowValidApprovalCountSql({
          applicationId: "?1",
          stepKey: "?2",
          round: "?3",
        })}) < ?4 THEN 1 ELSE json_extract('', '$') END AS ok`,
      ).bind(
        props.instance.applicationId,
        props.step.key,
        props.instance.currentRound,
        props.requiredApprovals,
      ),
    ])

    return { status: "pending" }
  } catch (error) {
    if (isAbortedByGuard(error) === false) {
      return new UnexpectedError("failed to persist workflow approval", { cause: error })
    }

    try {
      const [existingApproval, currentStep] = await Promise.all([
        props.c.env.DB.prepare(
          `SELECT 1 AS found
             FROM application_workflow_approvals
             WHERE application_id = ?1 AND step_key = ?2 AND round = ?3
               AND approver_id = ?4`,
        )
          .bind(
            props.instance.applicationId,
            props.step.key,
            props.instance.currentRound,
            props.actorEmployeeId,
          )
          .first<number>("found"),
        props.c.env.DB.prepare(
          `SELECT 1 AS found
             FROM application_requests application
             INNER JOIN application_workflow_instances workflow_instance
               ON workflow_instance.application_id = application.id
             WHERE application.id = ?1 AND application.status = 'pending'
               AND application.current_step = ?2
               AND workflow_instance.current_step_key = ?2
               AND workflow_instance.current_round = ?3`,
        )
          .bind(props.instance.applicationId, props.step.key, props.instance.currentRound)
          .first<number>("found"),
      ])

      if (existingApproval === null && currentStep === 1) {
        return new ConflictError(props.resolutionError.message, "workflow_unresolvable")
      }

      return new ConflictError("workflow step already changed", "already_decided")
    } catch (classificationError) {
      return new UnexpectedError("failed to classify workflow approval conflict", {
        cause: classificationError,
      })
    }
  }
}

async function loadRecordedApprovers(props: {
  c: Context
  instance: WorkflowInstance
  step: ApplicationWorkflowStep
}): Promise<ReadonlySet<number> | ApplicationError> {
  try {
    const rows = await props.c.env.DB.prepare(
      workflowValidApprovalsSql({
        applicationId: "?1",
        stepKey: "?2",
        round: "?3",
      }),
    )
      .bind(props.instance.applicationId, props.step.key, props.instance.currentRound)
      .all<{ represented_approver_id: number }>()

    return new Set(rows.results.map((row) => row.represented_approver_id))
  } catch (error) {
    return new UnexpectedError("failed to load workflow approval progress", { cause: error })
  }
}

function workflowTransitionConsistencyGuard(props: {
  db: D1Database
  applicationId: number
  previousStepKey: string
  previousRound: number
  nextStepKey: string
  nextRound: number
}): D1PreparedStatement {
  return props.db
    .prepare(
      `SELECT CASE WHEN EXISTS (
         SELECT 1
         FROM application_requests application
         INNER JOIN application_workflow_instances workflow_instance
           ON workflow_instance.application_id = application.id
         WHERE application.id = ?1 AND application.status = 'pending'
           AND (
             (application.current_step = ?2
               AND workflow_instance.current_step_key = ?2
               AND workflow_instance.current_round = ?3)
             OR
             (application.current_step = ?4
               AND workflow_instance.current_step_key = ?4
               AND workflow_instance.current_round = ?5)
           )
       ) THEN 1 ELSE json_extract('', '$') END AS ok`,
    )
    .bind(
      props.applicationId,
      props.previousStepKey,
      props.previousRound,
      props.nextStepKey,
      props.nextRound,
    )
}

async function rejectStep(props: {
  c: Context
  instance: WorkflowInstance
  templateCode: string
  actorEmployeeId: number
  actorAccountId: number
  representedApprover: number
  delegationId: number | null
  comment: string | null
  createdAt: string
  step: ApplicationWorkflowStep
}): Promise<WorkflowDecision | ApplicationError> {
  const action = props.step.rejection_behavior === "return" ? "return" : "reject"

  try {
    await props.c.env.DB.batch([
      approvalInsert(props, action),
      abortWhenPreviousStatementChangedNoRows(props.c.env.DB),
      props.step.rejection_behavior === "return"
        ? props.c.env.DB.prepare(
            "UPDATE application_requests SET current_step = ?2 WHERE id = ?1 AND status = 'pending'",
          ).bind(props.instance.applicationId, `returned:${props.step.key}`)
        : props.c.env.DB.prepare(
            "UPDATE application_requests SET status = 'rejected', current_step = NULL WHERE id = ?1 AND status = 'pending'",
          ).bind(props.instance.applicationId),
    ])

    return { status: props.step.rejection_behavior === "return" ? "pending" : "rejected" }
  } catch (error) {
    return isAbortedByGuard(error)
      ? new ConflictError("workflow step already changed", "already_decided")
      : new UnexpectedError("failed to reject workflow step", { cause: error })
  }
}

function approvalInsert(
  props: {
    c: Context
    instance: WorkflowInstance
    templateCode: string
    actorEmployeeId: number
    actorAccountId: number
    representedApprover: number
    delegationId: number | null
    comment: string | null
    createdAt: string
    step: ApplicationWorkflowStep
  },
  action: "approve" | "reject" | "return",
) {
  return props.c.env.DB.prepare(
    `INSERT INTO application_workflow_approvals
       (application_id, step_key, round, approver_id, approver_account_id,
        represented_approver_id, delegation_id, action, comment, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
       WHERE EXISTS (
         SELECT 1
         FROM application_workflow_instances workflow_instance
         INNER JOIN application_requests application ON application.id = workflow_instance.application_id
         WHERE workflow_instance.application_id = ?1
           AND workflow_instance.current_step_key = ?2
           AND workflow_instance.current_round = ?3
           AND application.status = 'pending'
           AND application.current_step = ?2
       )
       AND EXISTS (
         SELECT 1
         FROM application_workflow_step_snapshots snapshot
         INNER JOIN application_workflow_step_candidates candidate
           ON candidate.application_id = snapshot.application_id
          AND candidate.step_key = snapshot.step_key
          AND candidate.round = snapshot.round
          AND candidate.resolution_id = snapshot.resolution_id
         INNER JOIN accounts candidate_account
           ON candidate_account.id = candidate.candidate_account_id
         INNER JOIN account_employee_links candidate_link
           ON candidate_link.account_id = candidate_account.id
          AND candidate_link.employee_id = candidate.candidate_employee_id
         INNER JOIN employees candidate_employee
           ON candidate_employee.id = candidate.candidate_employee_id
         WHERE snapshot.application_id = ?1
           AND snapshot.step_key = ?2
           AND snapshot.round = ?3
           AND candidate.candidate_employee_id = ?6
           AND candidate_account.status = 'active'
           AND candidate_employee.status <> 'retired'
           AND (
             candidate.source = 'primary'
             OR (snapshot.escalated_at IS NOT NULL AND snapshot.escalated_at <= ?10)
           )
           AND (
             (?7 IS NULL AND ?4 = ?6 AND candidate.candidate_account_id = ?5)
             OR (
               ?7 IS NOT NULL
               AND EXISTS (
                 SELECT 1
                 FROM approval_delegations delegation
                 WHERE delegation.id = ?7
                   AND delegation.delegator_employee_id = ?6
                   AND delegation.delegate_employee_id = ?4
                   AND delegation.cancelled_at IS NULL
                   AND delegation.starts_at <= ?10
                   AND delegation.ends_at > ?10
                   AND (delegation.template_code IS NULL OR delegation.template_code = ?11)
               )
             )
           )
       )
       AND NOT EXISTS (
         SELECT 1 FROM application_workflow_approvals
         WHERE application_id = ?1 AND step_key = ?2 AND round = ?3 AND approver_id = ?4
       )
       AND NOT EXISTS (
         SELECT 1 FROM application_workflow_approvals
         WHERE application_id = ?1 AND step_key = ?2 AND round = ?3
           AND represented_approver_id = ?6
       )
       RETURNING approver_id`,
  ).bind(
    props.instance.applicationId,
    props.step.key,
    props.instance.currentRound,
    props.actorEmployeeId,
    props.actorAccountId,
    props.representedApprover,
    props.delegationId,
    action,
    props.comment,
    props.createdAt,
    props.templateCode,
  )
}
