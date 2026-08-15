import type { Session } from "@/contexts/company/domain/iam/session"
import type { Context } from "@/env"
import { ApplicationRepository } from "@/contexts/request/infrastructure/application-repository"
import { ApplicationWorkflowRepository } from "@/contexts/request/infrastructure/application-workflow-repository"
import { WorkflowSql } from "@/contexts/request/infrastructure/workflow-sql"
import { workflowReachableApprovalCountSql } from "@/contexts/request/infrastructure/workflow-reachable-approval-count-sql"
import { ensureWorkflowStepEscalation } from "@/contexts/request/application/workflow/ensure-workflow-step-escalation"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/d1/is-aborted-by-guard"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  UnprocessableError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { resolveActiveSystemAccountId } from "@/contexts/request/application/system-compatibility/to-system-account-id"
import type { AccountId } from "@system/domain/auth/account-id"

export type ReassignedWorkflowStep = {
  status: "pending"
  stepKey: string
  round: number
  candidateEmployeeIds: ReadonlyArray<number>
}

export class ReassignWorkflowStep {
  constructor(private readonly c: Context) {}

  async run(command: {
    session: Session
    applicationId: number
    candidateEmployeeIds: ReadonlyArray<number>
    requiredApprovals?: number
    reason: string
    reassignedAt: string
  }): Promise<ReassignedWorkflowStep | ApplicationError> {
    if (
      command.session.hasPermission("application:read:all") === false ||
      command.session.hasPermission("application_template:manage") === false
    ) {
      return new ForbiddenError("cannot repair application workflows", "forbidden")
    }
    const actorAccountId = await resolveActiveSystemAccountId(this.c, command.session.accountId)
    if (actorAccountId instanceof Error) {
      return new UnexpectedError("failed to resolve canonical workflow actor", {
        cause: actorAccountId,
      })
    }

    const application = await new ApplicationRepository(this.c).findById(command.applicationId)
    if (application instanceof Error) {
      return new UnexpectedError("failed to load application", { cause: application })
    }
    if (application === null) {
      return new NotFoundError("application not found", "application_not_found")
    }

    const instance = await new ApplicationWorkflowRepository(this.c).findInstance(
      command.applicationId,
    )
    if (instance instanceof Error) {
      return new UnexpectedError("failed to load workflow instance", { cause: instance })
    }
    if (instance === null) {
      return new NotFoundError("workflow instance not found", "workflow_not_found")
    }
    if (application.status !== "pending" || application.currentStep !== instance.currentStepKey) {
      return new ConflictError("workflow is not pending", "already_decided")
    }
    const candidateEmployeeIds = [...new Set(command.candidateEmployeeIds)]
    if (
      candidateEmployeeIds.length === 0 ||
      candidateEmployeeIds.includes(application.applicantId) ||
      candidateEmployeeIds.includes(command.session.employeeId)
    ) {
      return new UnprocessableError("applicant cannot be the repair approver", "invalid_candidate")
    }

    const step = instance.definition.steps.find(
      (candidate) => candidate.key === instance.currentStepKey,
    )
    if (step === undefined) {
      return new UnexpectedError("workflow current step is invalid")
    }

    const workflowRepository = new ApplicationWorkflowRepository(this.c)
    let currentSnapshot = await workflowRepository.findStepSnapshot(
      command.applicationId,
      instance.currentStepKey,
      instance.currentRound,
    )
    if (currentSnapshot instanceof Error) {
      return new UnexpectedError("failed to load workflow repair status", {
        cause: currentSnapshot,
      })
    }

    if (currentSnapshot !== null) {
      const escalated = await ensureWorkflowStepEscalation({
        c: this.c,
        snapshot: currentSnapshot,
        now: command.reassignedAt,
      })
      if (escalated instanceof Error) {
        return new UnexpectedError("failed to activate due workflow escalation", {
          cause: escalated,
        })
      }
      currentSnapshot = escalated
    }

    const reachableApprovalCount =
      currentSnapshot === null
        ? 0
        : await loadReachableApprovalCount({
            c: this.c,
            applicationId: command.applicationId,
            stepKey: instance.currentStepKey,
            round: instance.currentRound,
          })
    if (reachableApprovalCount instanceof Error) {
      return new UnexpectedError("failed to load workflow repair status", {
        cause: reachableApprovalCount,
      })
    }
    if (currentSnapshot !== null && reachableApprovalCount >= currentSnapshot.requiredApprovals) {
      return new ConflictError("workflow step can still reach quorum", "workflow_not_repairable")
    }

    const configuredRequiredApprovals =
      step.approval_mode === "minimum" ? (step.minimum_approvals ?? 1) : 1
    const quorumOverride = currentSnapshot === null && step.approval_mode === "all"

    if (quorumOverride && command.requiredApprovals === undefined) {
      return new UnprocessableError(
        "required approvals must be explicitly confirmed for a missing all-approval snapshot",
        "workflow_quorum_required",
      )
    }

    const requiredApprovals =
      currentSnapshot?.requiredApprovals ??
      (quorumOverride ? (command.requiredApprovals ?? 0) : configuredRequiredApprovals)

    if (
      command.requiredApprovals !== undefined &&
      (command.requiredApprovals !== requiredApprovals ||
        (quorumOverride && command.requiredApprovals !== candidateEmployeeIds.length))
    ) {
      return new UnprocessableError(
        "required approvals must preserve the frozen or configured quorum",
        "workflow_quorum_mismatch",
      )
    }
    if (candidateEmployeeIds.length < requiredApprovals) {
      return new UnprocessableError(
        "repair candidates cannot satisfy the frozen quorum",
        "workflow_unresolvable",
      )
    }

    let accounts: D1Result<{ id: AccountId; employee_id: number }>
    try {
      const placeholders = candidateEmployeeIds.map((_, index) => `?${index + 1}`).join(", ")
      accounts = await this.c.env.DB.prepare(
        `SELECT system_account.id, employee.id AS employee_id
         FROM system_accounts system_account
         INNER JOIN account_employee_links link
           ON CAST(link.account_id AS TEXT) = system_account.id
         INNER JOIN employees employee ON employee.id = link.employee_id
         WHERE employee.id IN (${placeholders}) AND employee.status <> 'retired'
           AND system_account.status = 'active'
         ORDER BY employee.id, system_account.id`,
      )
        .bind(...candidateEmployeeIds)
        .all<{ id: AccountId; employee_id: number }>()
    } catch (error) {
      return new UnexpectedError("failed to resolve repair candidate accounts", { cause: error })
    }

    const resolvedEmployeeIds = new Set(accounts.results.map((account) => account.employee_id))
    if (candidateEmployeeIds.some((employeeId) => resolvedEmployeeIds.has(employeeId) === false)) {
      return new UnprocessableError(
        "a repair candidate has no active account",
        "workflow_unresolvable",
      )
    }

    const round = instance.currentRound + 1
    const resolutionId = crypto.randomUUID()
    const snapshot = {
      requiredApprovals,
      activatedAt: command.reassignedAt,
      dueAt: null,
      escalatedAt: null,
      resolutionReason: "manual_repair" as const,
      resolutionId,
      candidates: accounts.results.map((account) => ({
        employeeId: account.employee_id,
        accountId: account.id,
        source: "primary" as const,
        selectorsJson: JSON.stringify([
          {
            selector_index: null,
            selector: { type: "manual_repair" },
            evidence: {
              type: "workflow_reassignment",
              actor_account_id: actorAccountId,
              reason: command.reason,
            },
          },
        ]),
        eligibleFrom: null,
        resolvedAt: command.reassignedAt,
      })),
    }

    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `UPDATE application_workflow_instances
             SET current_round = ?2, started_at = ?3, due_at = NULL
             WHERE application_id = ?1 AND current_step_key = ?4 AND current_round = ?5
               AND EXISTS (
                 SELECT 1 FROM application_requests
                 WHERE id = ?1 AND status = 'pending' AND current_step = ?4
               )
             RETURNING current_round`,
        ).bind(
          command.applicationId,
          round,
          command.reassignedAt,
          instance.currentStepKey,
          instance.currentRound,
        ),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        workflowRepairRequiredGuard({
          db: this.c.env.DB,
          applicationId: command.applicationId,
          stepKey: instance.currentStepKey,
          round: instance.currentRound,
        }),
        activeWorkflowActorGuard({
          db: this.c.env.DB,
          actorAccountId,
          actorEmployeeId: command.session.employeeId,
        }),
        repairCandidatesStillActiveGuard({
          db: this.c.env.DB,
          candidateEmployeeIds,
        }),
        ...new WorkflowSql(this.c.env.DB).insert({
          applicationId: command.applicationId,
          stepKey: instance.currentStepKey,
          round,
          snapshot,
        }),
        this.c.env.DB.prepare(
          `INSERT INTO application_workflow_events
               (application_id, step_key, round, event_type, actor_account_id,
                occurred_at, details_json)
             VALUES (?1, ?2, ?3, 'reassigned', ?4, ?5, ?6)`,
        ).bind(
          command.applicationId,
          instance.currentStepKey,
          round,
          actorAccountId,
          command.reassignedAt,
          JSON.stringify({
            candidate_employee_ids: candidateEmployeeIds,
            reason: command.reason,
            previous_round: instance.currentRound,
            required_approvals: requiredApprovals,
            quorum_override: quorumOverride,
          }),
        ),
      ])
    } catch (error) {
      if (isAbortedByGuard(error)) {
        const current = await workflowRepository.findInstance(command.applicationId)
        if (
          current === null ||
          current instanceof Error ||
          current.currentStepKey !== instance.currentStepKey ||
          current.currentRound !== instance.currentRound
        ) {
          return new ConflictError("workflow step already changed", "already_decided")
        }

        const reachable = await loadReachableApprovalCount({
          c: this.c,
          applicationId: command.applicationId,
          stepKey: instance.currentStepKey,
          round: instance.currentRound,
        })
        if (
          currentSnapshot !== null &&
          typeof reachable === "number" &&
          reachable >= currentSnapshot.requiredApprovals
        ) {
          return new ConflictError(
            "workflow step can still reach quorum",
            "workflow_not_repairable",
          )
        }

        return new UnprocessableError(
          "repair candidates are no longer available",
          "workflow_unresolvable",
        )
      }

      return new UnexpectedError("failed to reassign workflow step", { cause: error })
    }

    return {
      status: "pending",
      stepKey: instance.currentStepKey,
      round,
      candidateEmployeeIds,
    }
  }
}

function activeWorkflowActorGuard(props: {
  db: D1Database
  actorAccountId: AccountId
  actorEmployeeId: number
}): D1PreparedStatement {
  return props.db
    .prepare(
      `SELECT CASE WHEN EXISTS (
         SELECT 1
         FROM system_accounts account
         INNER JOIN account_employee_links link
           ON CAST(link.account_id AS TEXT) = account.id
          AND link.employee_id = ?2
         WHERE account.id = ?1 AND account.status = 'active'
       ) THEN 1 ELSE json_extract('', '$') END AS ok`,
    )
    .bind(props.actorAccountId, props.actorEmployeeId)
}

async function loadReachableApprovalCount(props: {
  c: Context
  applicationId: number
  stepKey: string
  round: number
}): Promise<number | Error> {
  try {
    return (
      (await props.c.env.DB.prepare(
        `SELECT (${workflowReachableApprovalCountSql({
          applicationId: "?1",
          stepKey: "?2",
          round: "?3",
        })}) AS total`,
      )
        .bind(props.applicationId, props.stepKey, props.round)
        .first<number>("total")) ?? 0
    )
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to count reachable approvals")
  }
}

function workflowRepairRequiredGuard(props: {
  db: D1Database
  applicationId: number
  stepKey: string
  round: number
}): D1PreparedStatement {
  return props.db
    .prepare(
      `SELECT CASE WHEN NOT EXISTS (
         SELECT 1 FROM application_workflow_step_snapshots
         WHERE application_id = ?1 AND step_key = ?2 AND round = ?3
       ) OR (${workflowReachableApprovalCountSql({
         applicationId: "?1",
         stepKey: "?2",
         round: "?3",
       })}) < (
         SELECT required_approvals FROM application_workflow_step_snapshots
         WHERE application_id = ?1 AND step_key = ?2 AND round = ?3
       ) THEN 1 ELSE json_extract('', '$') END AS ok`,
    )
    .bind(props.applicationId, props.stepKey, props.round)
}

function repairCandidatesStillActiveGuard(props: {
  db: D1Database
  candidateEmployeeIds: ReadonlyArray<number>
}): D1PreparedStatement {
  const placeholders = props.candidateEmployeeIds.map((_, index) => `?${index + 1}`).join(", ")
  const expectedParameter = props.candidateEmployeeIds.length + 1

  return props.db
    .prepare(
      `SELECT CASE WHEN (
         SELECT COUNT(DISTINCT employee.id)
         FROM employees employee
         INNER JOIN account_employee_links link ON link.employee_id = employee.id
         INNER JOIN system_accounts account
           ON account.id = CAST(link.account_id AS TEXT) AND account.status = 'active'
         WHERE employee.status <> 'retired' AND employee.id IN (${placeholders})
       ) = ?${expectedParameter} THEN 1 ELSE json_extract('', '$') END AS ok`,
    )
    .bind(...props.candidateEmployeeIds, props.candidateEmployeeIds.length)
}
