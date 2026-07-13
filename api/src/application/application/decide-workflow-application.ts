import type { ApplicationWorkflowStep } from "@/domain/application/application-workflow"
import type { Context } from "@/env"
import type { WorkflowInstance } from "@/infrastructure/application/application-workflow-repository"
import { ApplicationWorkflowRepository } from "@/infrastructure/application/application-workflow-repository"
import {
  resolveRepresentedApprover,
  resolveWorkflowApproverIds,
} from "@/lib/application/resolve-workflow-approvers"
import { dueAt } from "@/lib/application/evaluate-workflow"
import {
  abortWhenPreviousStatementChangedNoRows,
  isAbortedByGuard,
} from "@/lib/d1/batch-abort-guard"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type WorkflowDecision = { status: "pending" | "approved" | "rejected" }

export async function decideWorkflowApplication(props: {
  c: Context
  instance: WorkflowInstance
  templateCode: string
  applicantEmployeeId: number
  actorEmployeeId: number
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

  const isEscalated = props.instance.dueAt !== null && props.instance.dueAt < props.createdAt
  const selectors = isEscalated ? [...step.approvers, ...step.escalation_approvers] : step.approvers
  const candidates = await resolveWorkflowApproverIds({
    c: props.c,
    applicantEmployeeId: props.applicantEmployeeId,
    selectors,
  })

  if (candidates instanceof Error) {
    return new UnexpectedError("failed to resolve workflow approvers", { cause: candidates })
  }

  const representedApprover = await resolveRepresentedApprover({
    c: props.c,
    actorEmployeeId: props.actorEmployeeId,
    candidateEmployeeIds: candidates,
    templateCode: props.templateCode,
    now: props.createdAt,
    allowDelegation: step.allow_delegation,
  })

  if (representedApprover instanceof Error) {
    return new UnexpectedError("failed to resolve workflow delegation", {
      cause: representedApprover,
    })
  }

  if (representedApprover === null || props.actorEmployeeId === props.applicantEmployeeId) {
    return new ForbiddenError("cannot decide this workflow step", "forbidden")
  }

  if (props.action === "reject") {
    return rejectStep({ ...props, step, representedApprover })
  }

  const repository = new ApplicationWorkflowRepository(props.c)
  const existingApprovals = await repository.listApprovals(
    props.instance.applicationId,
    step.key,
    props.instance.currentRound,
  )

  if (existingApprovals instanceof Error) {
    return new UnexpectedError("failed to load workflow approvals", {
      cause: existingApprovals,
    })
  }

  if (existingApprovals.some((approval) => approval.approverId === props.actorEmployeeId)) {
    return new ConflictError("workflow step already decided by actor", "already_decided")
  }

  const represented = new Set(
    existingApprovals
      .filter((approval) => approval.action === "approve")
      .map((approval) => approval.representedApproverId),
  )
  represented.add(representedApprover)

  const required = requiredApprovals(step, candidates.length)
  const completed = represented.size >= required
  const nextStep = props.instance.definition.steps[currentIndex + 1]

  return persistApproval({
    ...props,
    step,
    representedApprover,
    completed,
    nextStep,
  })
}

function requiredApprovals(step: ApplicationWorkflowStep, candidateCount: number): number {
  if (step.approval_mode === "all") return Math.max(candidateCount, 1)
  if (step.approval_mode === "minimum") return step.minimum_approvals ?? 1
  return 1
}

async function persistApproval(props: {
  c: Context
  instance: WorkflowInstance
  actorEmployeeId: number
  representedApprover: number
  comment: string | null
  createdAt: string
  step: ApplicationWorkflowStep
  completed: boolean
  nextStep: ApplicationWorkflowStep | undefined
}): Promise<WorkflowDecision | ApplicationError> {
  const insert = approvalInsert(props, "approve")

  try {
    if (props.completed === false) {
      const result = await insert.run()
      return result.meta.changes === 1
        ? { status: "pending" }
        : new ConflictError("workflow step already changed", "already_decided")
    }

    const nextStep = props.nextStep

    if (nextStep === undefined) {
      await props.c.env.DB.batch([
        insert,
        abortWhenPreviousStatementChangedNoRows(props.c.env.DB),
        props.c.env.DB.prepare(
          "UPDATE applications SET status = 'approved', current_step = NULL WHERE id = ?1 AND status = 'pending'",
        ).bind(props.instance.applicationId),
      ])

      return { status: "approved" }
    }

    await props.c.env.DB.batch([
      insert,
      abortWhenPreviousStatementChangedNoRows(props.c.env.DB),
      props.c.env.DB.prepare(
        `UPDATE application_workflow_instances
           SET current_step_key = ?2, current_round = 1, started_at = ?3, due_at = ?4
           WHERE application_id = ?1 AND current_step_key = ?5`,
      ).bind(
        props.instance.applicationId,
        nextStep.key,
        props.createdAt,
        dueAt(props.createdAt, nextStep.due_days),
        props.step.key,
      ),
      props.c.env.DB.prepare(
        "UPDATE applications SET current_step = ?2 WHERE id = ?1 AND status = 'pending'",
      ).bind(props.instance.applicationId, nextStep.key),
    ])

    return { status: "pending" }
  } catch (error) {
    return isAbortedByGuard(error)
      ? new ConflictError("workflow step already changed", "already_decided")
      : new UnexpectedError("failed to persist workflow approval", { cause: error })
  }
}

async function rejectStep(props: {
  c: Context
  instance: WorkflowInstance
  actorEmployeeId: number
  representedApprover: number
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
            "UPDATE applications SET current_step = ?2 WHERE id = ?1 AND status = 'pending'",
          ).bind(props.instance.applicationId, `returned:${props.step.key}`)
        : props.c.env.DB.prepare(
            "UPDATE applications SET status = 'rejected', current_step = NULL WHERE id = ?1 AND status = 'pending'",
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
    actorEmployeeId: number
    representedApprover: number
    comment: string | null
    createdAt: string
    step: ApplicationWorkflowStep
  },
  action: "approve" | "reject" | "return",
) {
  return props.c.env.DB.prepare(
    `INSERT INTO application_workflow_approvals
       (application_id, step_key, round, approver_id, represented_approver_id, action, comment, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
       WHERE EXISTS (
         SELECT 1
         FROM application_workflow_instances workflow_instance
         INNER JOIN applications application ON application.id = workflow_instance.application_id
         WHERE workflow_instance.application_id = ?1
           AND workflow_instance.current_step_key = ?2
           AND workflow_instance.current_round = ?3
           AND application.status = 'pending'
           AND application.current_step = ?2
       )
       AND NOT EXISTS (
         SELECT 1 FROM application_workflow_approvals
         WHERE application_id = ?1 AND step_key = ?2 AND round = ?3 AND approver_id = ?4
       )`,
  ).bind(
    props.instance.applicationId,
    props.step.key,
    props.instance.currentRound,
    props.actorEmployeeId,
    props.representedApprover,
    action,
    props.comment,
    props.createdAt,
  )
}
