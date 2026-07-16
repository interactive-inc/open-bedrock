import type { ApplicationWorkflow } from "@/domain/application/application-workflow"
import { parseApplicationWorkflow } from "@/domain/application/application-workflow"
import { Application } from "@/domain/application/application.entity"
import type { Context } from "@/env"
import type { WorkflowStepSnapshotDraft } from "@/lib/application/resolve-workflow-step-snapshot"
import {
  applicationWorkflowApprovals,
  applicationWorkflowInstances,
  applicationWorkflowStepCandidates,
  applicationWorkflowStepSnapshots,
  applicationWorkflows,
} from "@/schema"
import { and, eq } from "drizzle-orm"
import {
  abortWhenPreviousStatementChangedNoRows,
  isAbortedByGuard,
} from "@/lib/d1/batch-abort-guard"

export type WorkflowInstance = {
  applicationId: number
  definition: ApplicationWorkflow
  currentStepKey: string
  currentRound: number
  startedAt: string
  dueAt: string | null
}

export type ApplicationWorkflowDefinitionRecord = {
  definition: ApplicationWorkflow
  revision: number
  updatedAt: string
  updatedByAccountId: number | null
}

export class WorkflowRevisionConflictError extends Error {
  constructor() {
    super("workflow revision conflict")
    this.name = "WorkflowRevisionConflictError"
  }
}

export type WorkflowStepSnapshot = {
  applicationId: number
  stepKey: string
  round: number
  requiredApprovals: number
  activatedAt: string
  dueAt: string | null
  escalatedAt: string | null
  resolutionReason: string
  resolutionId: string
  candidates: ReadonlyArray<{
    employeeId: number
    accountId: number
    source: string
    selectorsJson: string
    eligibleFrom: string | null
    resolvedAt: string
  }>
}

export class ApplicationWorkflowRepository {
  constructor(private readonly c: Context) {}

  async findDefinition(templateId: number): Promise<ApplicationWorkflow | null | Error> {
    const record = await this.findDefinitionRecord(templateId)

    return record instanceof Error || record === null ? record : record.definition
  }

  async findDefinitionRecord(
    templateId: number,
  ): Promise<ApplicationWorkflowDefinitionRecord | null | Error> {
    try {
      const row = await this.c.var.database
        .select({
          definitionJson: applicationWorkflows.definitionJson,
          revision: applicationWorkflows.revision,
          updatedAt: applicationWorkflows.updatedAt,
          updatedByAccountId: applicationWorkflows.updatedByAccountId,
        })
        .from(applicationWorkflows)
        .where(eq(applicationWorkflows.templateId, templateId))
        .limit(1)
        .then((rows) => rows.at(0))

      if (row === undefined) return null

      const definition = decode(row.definitionJson)

      return definition instanceof Error
        ? definition
        : {
            definition,
            revision: row.revision,
            updatedAt: row.updatedAt,
            updatedByAccountId: row.updatedByAccountId,
          }
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load application workflow")
    }
  }

  async saveDefinition(props: {
    templateId: number
    definition: ApplicationWorkflow
    expectedRevision: number
    updatedByAccountId: number
    updatedAt: string
  }): Promise<ApplicationWorkflowDefinitionRecord | WorkflowRevisionConflictError | Error> {
    const nextRevision = props.expectedRevision === 0 ? 1 : props.expectedRevision + 1

    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `INSERT INTO application_workflows
               (template_id, definition_json, updated_at, revision, updated_by_account_id)
             SELECT ?1, ?2, ?5, CASE WHEN ?3 = 0 THEN 1 ELSE ?3 + 1 END, ?4
             WHERE ?3 = 0
                OR EXISTS (
                  SELECT 1 FROM application_workflows WHERE template_id = ?1
                )
             ON CONFLICT(template_id) DO UPDATE SET
               definition_json = excluded.definition_json,
               updated_at = excluded.updated_at,
               revision = application_workflows.revision + 1,
               updated_by_account_id = excluded.updated_by_account_id
             WHERE ?3 > 0 AND application_workflows.revision = ?3
             RETURNING revision`,
        ).bind(
          props.templateId,
          JSON.stringify(props.definition),
          props.expectedRevision,
          props.updatedByAccountId,
          props.updatedAt,
        ),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        this.c.env.DB.prepare(
          `INSERT INTO application_workflow_revisions
               (template_id, revision, definition_json, updated_by_account_id, created_at)
             SELECT template_id, revision, definition_json, updated_by_account_id, updated_at
             FROM application_workflows
             WHERE template_id = ?1 AND revision = ?2`,
        ).bind(props.templateId, nextRevision),
      ])

      return {
        definition: props.definition,
        revision: nextRevision,
        updatedAt: props.updatedAt,
        updatedByAccountId: props.updatedByAccountId,
      }
    } catch (error) {
      return isAbortedByGuard(error)
        ? new WorkflowRevisionConflictError()
        : error instanceof Error
          ? error
          : new Error("failed to save application workflow")
    }
  }

  async createInstance(props: {
    applicationId: number
    definition: ApplicationWorkflow
    currentStepKey: string
    startedAt: string
    dueAt: string | null
    stepSnapshot: WorkflowStepSnapshotDraft
  }): Promise<null | Error> {
    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `INSERT INTO application_workflow_instances
             (application_id, definition_json, current_step_key, started_at, due_at)
             SELECT ?1, ?2, ?3, ?4, ?5
             WHERE EXISTS (
               SELECT 1 FROM applications WHERE id = ?1 AND status = 'pending'
             )
             RETURNING application_id`,
        ).bind(
          props.applicationId,
          JSON.stringify(props.definition),
          props.currentStepKey,
          props.startedAt,
          props.dueAt,
        ),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        ...workflowStepSnapshotInsertStatements({
          db: this.c.env.DB,
          applicationId: props.applicationId,
          stepKey: props.currentStepKey,
          round: 1,
          snapshot: props.stepSnapshot,
        }),
        this.c.env.DB.prepare(
          `UPDATE applications SET current_step = ?2
             WHERE id = ?1 AND status = 'pending'
             RETURNING id`,
        ).bind(props.applicationId, props.currentStepKey),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
      ])

      return null
    } catch (error) {
      return isAbortedByGuard(error)
        ? new Error("application is not pending")
        : error instanceof Error
          ? error
          : new Error("failed to create workflow instance")
    }
  }

  async createApplicationWithInstance(props: {
    application: Application
    definition: ApplicationWorkflow
    currentStepKey: string
    startedAt: string
    dueAt: string | null
    stepSnapshot: WorkflowStepSnapshotDraft
  }): Promise<Application | Error> {
    const creationId = crypto.randomUUID()

    try {
      const results = await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `INSERT INTO applications
               (template_id, applicant_id, status, current_step, payload, created_at,
                workflow_creation_id)
             VALUES (?1, ?2, 'pending', ?3, ?4, ?5, ?6)
             RETURNING id, template_id AS templateId, applicant_id AS applicantId,
               status, current_step AS currentStep, payload, created_at AS createdAt`,
        ).bind(
          props.application.templateId,
          props.application.applicantId,
          props.currentStepKey,
          JSON.stringify(props.application.payload),
          props.application.createdAt,
          creationId,
        ),
        this.c.env.DB.prepare(
          `INSERT INTO application_workflow_instances
               (application_id, definition_json, current_step_key, started_at, due_at)
             SELECT id, ?2, ?3, ?4, ?5
             FROM applications
             WHERE workflow_creation_id = ?1`,
        ).bind(
          creationId,
          JSON.stringify(props.definition),
          props.currentStepKey,
          props.startedAt,
          props.dueAt,
        ),
        ...workflowStepSnapshotInsertByCreationStatements({
          db: this.c.env.DB,
          creationId,
          stepKey: props.currentStepKey,
          round: 1,
          snapshot: props.stepSnapshot,
        }),
        this.c.env.DB.prepare(
          `UPDATE applications
             SET workflow_creation_id = NULL
             WHERE workflow_creation_id = ?1
             RETURNING id`,
        ).bind(creationId),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
      ])

      const row = results.at(0)?.results.at(0) as
        | Parameters<typeof Application.fromRow>[0]
        | undefined

      return row === undefined
        ? new Error("failed to create workflow application")
        : Application.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create workflow application")
    }
  }

  async createPersonnelActionRequestWithInstance(props: {
    application: Application
    definition: ApplicationWorkflow
    currentStepKey: string
    startedAt: string
    dueAt: string | null
    stepSnapshot: WorkflowStepSnapshotDraft
    request: {
      id: string
      targetEmployeeId: number | null
      subjectSnapshotJson: string | null
      kind: string
      payloadJson: string
      requestedByEmployeeId: number
      baseEmployeeRevision: number
      baseOrganizationRevision: number | null
      createdAt: number
      payloadFingerprint: string
      targetDepartmentCode: string | null
    }
    auditStatements: ReadonlyArray<D1PreparedStatement>
  }): Promise<Application | Error> {
    const creationId = crypto.randomUUID()
    try {
      const results = await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `INSERT INTO applications
             (template_id, applicant_id, status, current_step, payload, created_at,
              workflow_creation_id)
           VALUES (?1, ?2, 'pending', ?3, ?4, ?5, ?6)
           RETURNING id, template_id AS templateId, applicant_id AS applicantId,
             status, current_step AS currentStep, payload, created_at AS createdAt`,
        ).bind(
          props.application.templateId,
          props.application.applicantId,
          props.currentStepKey,
          JSON.stringify(props.application.payload),
          props.application.createdAt,
          creationId,
        ),
        this.c.env.DB.prepare(
          `INSERT INTO application_workflow_instances
             (application_id, definition_json, current_step_key, started_at, due_at)
           SELECT id, ?2, ?3, ?4, ?5 FROM applications WHERE workflow_creation_id = ?1`,
        ).bind(
          creationId,
          JSON.stringify(props.definition),
          props.currentStepKey,
          props.startedAt,
          props.dueAt,
        ),
        ...workflowStepSnapshotInsertByCreationStatements({
          db: this.c.env.DB,
          creationId,
          stepKey: props.currentStepKey,
          round: 1,
          snapshot: props.stepSnapshot,
        }),
        this.c.env.DB.prepare(
          `INSERT INTO personnel_action_requests
             (id, application_id, target_employee_id, kind, payload_json,
              requested_by_employee_id, base_employee_revision, base_organization_revision,
              created_at, applied_action_id)
           SELECT ?2, id, ?3, ?4, ?5, ?6, ?7, ?8, ?9, NULL
           FROM applications WHERE workflow_creation_id = ?1`,
        ).bind(
          creationId,
          props.request.id,
          props.request.targetEmployeeId,
          props.request.kind,
          props.request.payloadJson,
          props.request.requestedByEmployeeId,
          props.request.baseEmployeeRevision,
          props.request.baseOrganizationRevision,
          props.request.createdAt,
        ),
        ...props.auditStatements,
        this.c.env.DB.prepare(
          `INSERT INTO application_subjects
             (application_id, subject_type, subject_employee_id, subject_snapshot_json,
              target_department_code)
           SELECT id, CASE WHEN ?2 IS NULL THEN 'prospective_employee' ELSE 'employee' END,
                  ?2, ?3, ?4
           FROM applications WHERE workflow_creation_id = ?1`,
        ).bind(
          creationId,
          props.request.targetEmployeeId,
          props.request.subjectSnapshotJson,
          props.request.targetDepartmentCode,
        ),
        this.c.env.DB.prepare(
          `INSERT INTO application_completion_bindings
             (application_id, handler_key, resource_id, payload_fingerprint, created_at)
           SELECT id, 'personnel_action', ?2, ?3, ?4
           FROM applications WHERE workflow_creation_id = ?1`,
        ).bind(
          creationId,
          props.request.id,
          props.request.payloadFingerprint,
          props.request.createdAt,
        ),
        this.c.env.DB.prepare(
          `UPDATE applications SET workflow_creation_id = NULL
           WHERE workflow_creation_id = ?1 RETURNING id`,
        ).bind(creationId),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
      ])
      const row = results.at(0)?.results.at(0) as
        | Parameters<typeof Application.fromRow>[0]
        | undefined
      return row === undefined
        ? new Error("failed to create personnel action request")
        : Application.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create personnel action request")
    }
  }

  async findNextStepRound(applicationId: number, stepKey: string): Promise<number | Error> {
    try {
      const latestRound = await this.c.env.DB.prepare(
        `SELECT COALESCE(MAX(round), 0) AS latest_round
         FROM (
           SELECT round FROM application_workflow_step_snapshots
           WHERE application_id = ?1 AND step_key = ?2
           UNION ALL
           SELECT round FROM application_workflow_approvals
           WHERE application_id = ?1 AND step_key = ?2
         )`,
      )
        .bind(applicationId, stepKey)
        .first<number>("latest_round")

      return (latestRound ?? 0) + 1
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to resolve next workflow round")
    }
  }

  async findStepSnapshot(
    applicationId: number,
    stepKey: string,
    round: number,
  ): Promise<WorkflowStepSnapshot | null | Error> {
    try {
      const snapshot = await this.c.var.database
        .select()
        .from(applicationWorkflowStepSnapshots)
        .where(
          and(
            eq(applicationWorkflowStepSnapshots.applicationId, applicationId),
            eq(applicationWorkflowStepSnapshots.stepKey, stepKey),
            eq(applicationWorkflowStepSnapshots.round, round),
          ),
        )
        .limit(1)
        .then((rows) => rows.at(0))

      if (snapshot === undefined) return null

      const candidates = await this.c.var.database
        .select()
        .from(applicationWorkflowStepCandidates)
        .where(
          and(
            eq(applicationWorkflowStepCandidates.applicationId, applicationId),
            eq(applicationWorkflowStepCandidates.stepKey, stepKey),
            eq(applicationWorkflowStepCandidates.round, round),
            eq(applicationWorkflowStepCandidates.resolutionId, snapshot.resolutionId),
          ),
        )

      return {
        applicationId: snapshot.applicationId,
        stepKey: snapshot.stepKey,
        round: snapshot.round,
        requiredApprovals: snapshot.requiredApprovals,
        activatedAt: snapshot.activatedAt,
        dueAt: snapshot.dueAt,
        escalatedAt: snapshot.escalatedAt,
        resolutionReason: snapshot.resolutionReason,
        resolutionId: snapshot.resolutionId,
        candidates: candidates.map((candidate) => ({
          employeeId: candidate.candidateEmployeeId,
          accountId: candidate.candidateAccountId,
          source: candidate.source,
          selectorsJson: candidate.selectorsJson,
          eligibleFrom: candidate.eligibleFrom,
          resolvedAt: candidate.resolvedAt,
        })),
      }
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load workflow step snapshot")
    }
  }

  async findInstance(applicationId: number): Promise<WorkflowInstance | null | Error> {
    try {
      const row = await this.c.var.database
        .select()
        .from(applicationWorkflowInstances)
        .where(eq(applicationWorkflowInstances.applicationId, applicationId))
        .limit(1)
        .then((rows) => rows.at(0))

      if (row === undefined) return null

      const definition = decode(row.definitionJson)

      return definition instanceof Error
        ? definition
        : {
            applicationId: row.applicationId,
            definition,
            currentStepKey: row.currentStepKey,
            currentRound: row.currentRound,
            startedAt: row.startedAt,
            dueAt: row.dueAt,
          }
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load workflow instance")
    }
  }

  async listApprovals(applicationId: number, stepKey?: string, round?: number) {
    try {
      return await this.c.var.database
        .select()
        .from(applicationWorkflowApprovals)
        .where(eq(applicationWorkflowApprovals.applicationId, applicationId))
        .then((rows) =>
          rows.filter(
            (row) =>
              (stepKey === undefined || row.stepKey === stepKey) &&
              (round === undefined || row.round === round),
          ),
        )
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load workflow approvals")
    }
  }
}

function workflowStepSnapshotInsertByCreationStatements(props: {
  db: D1Database
  creationId: string
  stepKey: string
  round: number
  snapshot: WorkflowStepSnapshotDraft
}): ReadonlyArray<D1PreparedStatement> {
  return [
    props.db
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
    ...chunk(props.snapshot.candidates, 16).map((candidates) =>
      props.db
        .prepare(
          `WITH candidate_rows
             (candidate_employee_id, candidate_account_id, source, selectors_json,
              eligible_from, resolved_at) AS (VALUES ${candidateValueRows(candidates.length, 5)})
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
          ...candidates.flatMap(candidateValues),
        ),
    ),
  ]
}

export function workflowStepSnapshotInsertStatements(props: {
  db: D1Database
  applicationId: number
  stepKey: string
  round: number
  snapshot: WorkflowStepSnapshotDraft
  ignoreConflicts?: boolean
}): ReadonlyArray<D1PreparedStatement> {
  const insert = props.ignoreConflicts ? "INSERT OR IGNORE" : "INSERT"

  return [
    props.db
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
    ...chunk(props.snapshot.candidates, 16).map((candidates) => {
      const bindings: Array<unknown> = [
        props.applicationId,
        props.stepKey,
        props.round,
        props.snapshot.resolutionId,
        ...candidates.flatMap(candidateValues),
      ]
      const rows = candidateValueRows(candidates.length, 5)
      const winnerCondition = props.ignoreConflicts
        ? `WHERE EXISTS (
             SELECT 1 FROM application_workflow_step_snapshots
             WHERE application_id = ?1 AND step_key = ?2 AND round = ?3
               AND resolution_id = ?4
           )`
        : ""

      return props.db
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

export function conditionalWorkflowStepSnapshotInsertStatements(props: {
  db: D1Database
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
    props.db
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
    ...chunk(props.snapshot.candidates, 14).map((candidates) => {
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
        ...candidates.flatMap(candidateValues),
      ]

      return props.db
        .prepare(
          `WITH candidate_rows
             (candidate_employee_id, candidate_account_id, source, selectors_json,
              eligible_from, resolved_at) AS (VALUES ${candidateValueRows(candidates.length, 13)})
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

type WorkflowCandidate = WorkflowStepSnapshotDraft["candidates"][number]

function candidateValues(candidate: WorkflowCandidate): Array<unknown> {
  return [
    candidate.employeeId,
    candidate.accountId,
    candidate.source,
    candidate.selectorsJson,
    candidate.eligibleFrom,
    candidate.resolvedAt,
  ]
}

function candidateValueRows(rowCount: number, firstParameter: number): string {
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const start = firstParameter + rowIndex * 6
    return `(?${start}, ?${start + 1}, ?${start + 2}, ?${start + 3}, ?${start + 4}, ?${start + 5})`
  }).join(", ")
}

function chunk<T>(values: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  )
}

export function workflowValidApprovalCountSql(props: {
  applicationId: string
  stepKey: string
  round: string
}): string {
  return `SELECT COUNT(*) FROM (${workflowValidApprovalsSql(props)})`
}

export function workflowReachableApprovalCountSql(props: {
  applicationId: string
  stepKey: string
  round: string
}): string {
  return `SELECT COUNT(*) FROM (
    SELECT represented_approver_id
    FROM (${workflowValidApprovalsSql(props)})
    UNION
    SELECT candidate.candidate_employee_id AS represented_approver_id
    FROM application_workflow_step_snapshots snapshot
    INNER JOIN application_workflow_step_candidates candidate
      ON candidate.application_id = snapshot.application_id
     AND candidate.step_key = snapshot.step_key
     AND candidate.round = snapshot.round
     AND candidate.resolution_id = snapshot.resolution_id
    INNER JOIN accounts candidate_account
      ON candidate_account.id = candidate.candidate_account_id
     AND candidate_account.status = 'active'
    INNER JOIN employees candidate_employee
      ON candidate_employee.id = candidate.candidate_employee_id
     AND candidate_employee.status <> 'retired'
    WHERE snapshot.application_id = ${props.applicationId}
      AND snapshot.step_key = ${props.stepKey}
      AND snapshot.round = ${props.round}
      AND (
        candidate.source = 'primary'
        OR (candidate.source = 'escalation' AND snapshot.escalated_at IS NOT NULL)
      )
  )`
}

export function workflowValidApprovalsSql(props: {
  applicationId: string
  stepKey: string
  round: string
}): string {
  return `SELECT DISTINCT approval.represented_approver_id AS represented_approver_id
    FROM application_workflow_approvals approval
    WHERE approval.application_id = ${props.applicationId}
      AND approval.step_key = ${props.stepKey}
      AND approval.round = ${props.round}
      AND approval.action = 'approve'
      AND EXISTS (
        SELECT 1
        FROM application_workflow_step_snapshots snapshot
        INNER JOIN application_workflow_step_candidates candidate
          ON candidate.application_id = snapshot.application_id
         AND candidate.step_key = snapshot.step_key
         AND candidate.round = snapshot.round
         AND candidate.resolution_id = snapshot.resolution_id
        WHERE snapshot.application_id = approval.application_id
          AND snapshot.step_key = approval.step_key
          AND snapshot.round = approval.round
          AND candidate.candidate_employee_id = approval.represented_approver_id
          AND (
            candidate.source = 'primary'
            OR (snapshot.escalated_at IS NOT NULL AND snapshot.escalated_at <= approval.created_at)
          )
      )`
}

function decode(json: string): ApplicationWorkflow | Error {
  try {
    return parseApplicationWorkflow(JSON.parse(json))
  } catch {
    return new Error("workflow definition is not valid JSON")
  }
}
