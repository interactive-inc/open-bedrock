import type { WorkflowStepSnapshotDraft } from "@/lib/application/resolve-workflow-step-snapshot"
import { workflowValidApprovalCountSql } from "@/infrastructure/application/workflow-valid-approval-count-sql"

type WorkflowCandidate = WorkflowStepSnapshotDraft["candidates"][number]

/**
 * ワークフローステップスナップショットとその候補行を INSERT する D1 文を組み立てる。
 * 候補行はバインド上限を避けるためチャンク分割する
 */
export class WorkflowSql {
  constructor(private readonly db: D1Database) {
    Object.freeze(this)
  }

  insert(props: {
    applicationId: number
    stepKey: string
    round: number
    snapshot: WorkflowStepSnapshotDraft
    ignoreConflicts?: boolean
  }): ReadonlyArray<D1PreparedStatement> {
    const insert = props.ignoreConflicts ? "INSERT OR IGNORE" : "INSERT"

    return [
      this.db
        .prepare(
          `${insert} INTO application_workflow_step_snapshots
             (application_id, step_key, round, required_approvals, activated_at, due_at,
              escalated_at, resolution_reason, resolution_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
        )
        .bind(
          props.applicationId,
          props.stepKey,
          props.round,
          props.snapshot.requiredApprovals,
          props.snapshot.activatedAt,
          props.snapshot.dueAt,
          props.snapshot.escalatedAt,
          props.snapshot.resolutionReason,
          props.snapshot.resolutionId,
        ),
      ...this.chunk(props.snapshot.candidates, 16).map((candidates) => {
        const bindings: Array<unknown> = [
          props.applicationId,
          props.stepKey,
          props.round,
          props.snapshot.resolutionId,
          ...candidates.flatMap((candidate) => this.candidateValues(candidate)),
        ]
        const rows = this.candidateValueRows(candidates.length, 5)
        const winnerCondition = props.ignoreConflicts
          ? `WHERE EXISTS (
               SELECT 1 FROM application_workflow_step_snapshots
               WHERE application_id = ?1 AND step_key = ?2 AND round = ?3
                 AND resolution_id = ?4
             )`
          : ""

        return this.db
          .prepare(
            `WITH candidate_rows
               (candidate_employee_id, candidate_account_id, source, selectors_json,
                eligible_from, resolved_at) AS (VALUES ${rows})
             ${insert} INTO application_workflow_step_candidates
               (application_id, step_key, round, candidate_employee_id, candidate_account_id,
                source, selectors_json, resolution_id, eligible_from, resolved_at)
             SELECT ?1, ?2, ?3, candidate_employee_id, candidate_account_id,
                    source, selectors_json, ?4, eligible_from, resolved_at
             FROM candidate_rows
             ${winnerCondition}`,
          )
          .bind(...bindings)
      }),
    ]
  }

  insertByCreation(props: {
    creationId: string
    stepKey: string
    round: number
    snapshot: WorkflowStepSnapshotDraft
  }): ReadonlyArray<D1PreparedStatement> {
    return [
      this.db
        .prepare(
          `INSERT INTO application_workflow_step_snapshots
             (application_id, step_key, round, required_approvals, activated_at, due_at,
              escalated_at, resolution_reason, resolution_id)
           SELECT id, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
           FROM applications
           WHERE workflow_creation_id = ?1`,
        )
        .bind(
          props.creationId,
          props.stepKey,
          props.round,
          props.snapshot.requiredApprovals,
          props.snapshot.activatedAt,
          props.snapshot.dueAt,
          props.snapshot.escalatedAt,
          props.snapshot.resolutionReason,
          props.snapshot.resolutionId,
        ),
      ...this.chunk(props.snapshot.candidates, 16).map((candidates) =>
        this.db
          .prepare(
            `WITH candidate_rows
               (candidate_employee_id, candidate_account_id, source, selectors_json,
                eligible_from, resolved_at) AS (VALUES ${this.candidateValueRows(candidates.length, 5)})
             INSERT INTO application_workflow_step_candidates
               (application_id, step_key, round, candidate_employee_id, candidate_account_id,
                source, selectors_json, resolution_id, eligible_from, resolved_at)
             SELECT application.id, ?2, ?3, candidate_employee_id, candidate_account_id,
                    source, selectors_json, ?4, eligible_from, resolved_at
             FROM candidate_rows
             CROSS JOIN applications application
             WHERE application.workflow_creation_id = ?1`,
          )
          .bind(
            props.creationId,
            props.stepKey,
            props.round,
            props.snapshot.resolutionId,
            ...candidates.flatMap((candidate) => this.candidateValues(candidate)),
          ),
      ),
    ]
  }

  conditionalInsert(props: {
    applicationId: number
    stepKey: string
    round: number
    snapshot: WorkflowStepSnapshotDraft
    currentStepKey: string
    currentRound: number
    requiredApprovals: number
  }): ReadonlyArray<D1PreparedStatement> {
    const activationCondition = `EXISTS (
      SELECT 1
      FROM application_workflow_instances workflow_instance
      INNER JOIN applications application ON application.id = workflow_instance.application_id
      WHERE workflow_instance.application_id = ?1
        AND workflow_instance.current_step_key = ?10
        AND workflow_instance.current_round = ?11
        AND application.status = 'pending'
        AND application.current_step = ?10
        AND (${workflowValidApprovalCountSql({
          applicationId: "?1",
          stepKey: "?10",
          round: "?11",
        })}) >= ?12
    )`

    return [
      this.db
        .prepare(
          `INSERT OR IGNORE INTO application_workflow_step_snapshots
             (application_id, step_key, round, required_approvals, activated_at, due_at,
              escalated_at, resolution_reason, resolution_id)
             SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
             WHERE ${activationCondition}`,
        )
        .bind(
          props.applicationId,
          props.stepKey,
          props.round,
          props.snapshot.requiredApprovals,
          props.snapshot.activatedAt,
          props.snapshot.dueAt,
          props.snapshot.escalatedAt,
          props.snapshot.resolutionReason,
          props.snapshot.resolutionId,
          props.currentStepKey,
          props.currentRound,
          props.requiredApprovals,
        ),
      ...this.chunk(props.snapshot.candidates, 14).map((candidates) => {
        const bindings: Array<unknown> = [
          props.applicationId,
          props.stepKey,
          props.round,
          props.snapshot.requiredApprovals,
          props.snapshot.activatedAt,
          props.snapshot.dueAt,
          props.snapshot.escalatedAt,
          props.snapshot.resolutionReason,
          props.snapshot.resolutionId,
          props.currentStepKey,
          props.currentRound,
          props.requiredApprovals,
          ...candidates.flatMap((candidate) => this.candidateValues(candidate)),
        ]

        return this.db
          .prepare(
            `WITH candidate_rows
               (candidate_employee_id, candidate_account_id, source, selectors_json,
                eligible_from, resolved_at) AS (VALUES ${this.candidateValueRows(candidates.length, 13)})
             INSERT OR IGNORE INTO application_workflow_step_candidates
               (application_id, step_key, round, candidate_employee_id, candidate_account_id,
                source, selectors_json, resolution_id, eligible_from, resolved_at)
             SELECT ?1, ?2, ?3, candidate_employee_id, candidate_account_id,
                    source, selectors_json, ?9, eligible_from, resolved_at
             FROM candidate_rows
             WHERE ${activationCondition}
                 AND EXISTS (
                   SELECT 1 FROM application_workflow_step_snapshots
                   WHERE application_id = ?1 AND step_key = ?2 AND round = ?3
                     AND resolution_id = ?9
                 )`,
          )
          .bind(...bindings)
      }),
    ]
  }

  private candidateValues(candidate: WorkflowCandidate): Array<unknown> {
    return [
      candidate.employeeId,
      candidate.accountId,
      candidate.source,
      candidate.selectorsJson,
      candidate.eligibleFrom,
      candidate.resolvedAt,
    ]
  }

  private candidateValueRows(rowCount: number, firstParameter: number): string {
    return Array.from({ length: rowCount }, (_, rowIndex) => {
      const start = firstParameter + rowIndex * 6
      return `(?${start}, ?${start + 1}, ?${start + 2}, ?${start + 3}, ?${start + 4}, ?${start + 5})`
    }).join(", ")
  }

  private chunk<T>(values: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> {
    return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
      values.slice(index * size, (index + 1) * size),
    )
  }
}
