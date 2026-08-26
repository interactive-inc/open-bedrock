import { createCompanySystemAuditEvent } from "@/contexts/company/lib/audit/create-company-system-audit-event"
import { containsDate } from "@/contexts/company/domain/definitions/contains-date.definition"
import type { DirectPersonnelActionCommand } from "@/contexts/company/domain/definitions/direct-personnel-action-command.definition"
import type {
  LifecycleSchedule,
  LifecycleVersionMutation,
} from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import type { PersonnelActionProjection } from "@/contexts/company/domain/policies/project-personnel-action.policy"
import { stableLifecycleJson } from "@/contexts/company/domain/definitions/stable-lifecycle-json.definition"
import { toWorkforceOrganizationUnitId } from "@/contexts/company/domain/definitions/to-workforce-organization-unit-id.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type { PersonnelActionRecord } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action.adapter"
import { AbortWhenPreviousStatementChangedNoRowsAdapter } from "@/contexts/company/infrastructure/adapters/database/abort-when-previous-statement-changed-no-rows.adapter"
import { isAbortedByGuard } from "@/contexts/company/lib/database/is-aborted-by-guard"
import {
  CompanyConflictError,
  CompanyOperationError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import type { ProposalDigest } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { SystemD1AuthorizedExecutionAdapter } from "@system/infrastructure/adapters/workflow/system-d1-authorized-execution.adapter"

type CurrentLifecycleProjection = {
  status: "active" | "leave" | "retired"
  departmentCode: string | null
  assignmentType: "primary" | null
  positionTitle: string | null
  managerEmployeeId: EmployeeId | null
  managerEmployeeCode: string | null
}

function currentProjection(
  schedule: LifecycleSchedule,
  date: string,
  employeeCodes: ReadonlyMap<EmployeeId, string>,
): CurrentLifecycleProjection {
  const employment = schedule.employments.find((period) => containsDate(period, date))

  if (employment === undefined) {
    return {
      status: "retired",
      departmentCode: null,
      assignmentType: null,
      positionTitle: null,
      managerEmployeeId: null,
      managerEmployeeCode: null,
    }
  }

  const status = schedule.statuses.find(
    (period) => period.employmentPeriodId === employment.employmentId && containsDate(period, date),
  )
  const primary = schedule.assignments.find(
    (period) =>
      period.employmentPeriodId === employment.employmentId &&
      period.assignmentType === "primary" &&
      containsDate(period, date),
  )

  return {
    status: status?.status ?? "active",
    departmentCode: primary?.departmentCode ?? null,
    assignmentType: primary === undefined ? null : "primary",
    positionTitle: primary?.positionTitle ?? null,
    managerEmployeeId: primary?.managerEmployeeId ?? null,
    managerEmployeeCode:
      primary?.managerEmployeeId === null || primary?.managerEmployeeId === undefined
        ? null
        : (employeeCodes.get(primary.managerEmployeeId) ?? null),
  }
}

function mutationStatements(
  db: D1Database,
  mutation: LifecycleVersionMutation,
  businessDate: string,
): ReadonlyArray<D1PreparedStatement> {
  switch (mutation.periodType) {
    case "employment": {
      const period = mutation.after
      return [
        db
          .prepare(
            `INSERT INTO company_employment_period_versions
             (period_id, revision, employee_id, starts_on, ends_on, is_void,
              recorded_by_action_id, recorded_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
          )
          .bind(
            period.periodId,
            period.revision,
            period.employeeId,
            period.startsOn,
            period.endsOn,
            period.isVoid ? 1 : 0,
            period.recordedByActionId,
            period.recordedAt,
          ),
        db
          .prepare(
            `INSERT OR IGNORE INTO company_employments
               (id, employee_id, contract_name, employment_type, hire_date, status,
                termination_date, created_at, updated_at)
             SELECT ?1, ?2, employee.official_name, 'FULL_TIME', ?3,
                    CASE WHEN ?4 IS NULL AND ?5 = 0 THEN 'ACTIVE' ELSE 'TERMINATED' END,
                    CASE WHEN ?4 IS NULL THEN NULL ELSE date(?4, '-1 day') END,
                    ?6, ?6
             FROM company_employees AS employee
             WHERE employee.id = ?2`,
          )
          .bind(
            period.employmentId,
            period.employeeId,
            period.startsOn,
            period.endsOn,
            period.isVoid ? 1 : 0,
            period.recordedAt * 1_000,
          ),
        db
          .prepare(
            `UPDATE company_employments
             SET termination_date = CASE WHEN ?2 IS NULL THEN NULL ELSE date(?2, '-1 day') END,
                 status = CASE WHEN ?2 IS NULL AND ?3 = 0 THEN status ELSE 'TERMINATED' END,
                 updated_at = max(updated_at, ?4)
             WHERE id = ?1`,
          )
          .bind(
            period.employmentId,
            period.endsOn,
            period.isVoid ? 1 : 0,
            period.recordedAt * 1_000,
          ),
      ]
    }
    case "status": {
      const period = mutation.after
      return [
        db
          .prepare(
            `INSERT INTO company_employee_status_period_versions
             (period_id, revision, employment_period_id, employee_id, status,
              starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
          )
          .bind(
            period.periodId,
            period.revision,
            period.employmentPeriodId,
            period.employeeId,
            period.status,
            period.startsOn,
            period.endsOn,
            period.isVoid ? 1 : 0,
            period.recordedByActionId,
            period.recordedAt,
          ),
        db
          .prepare(
            `UPDATE company_employments
             SET status = ?2, updated_at = max(updated_at, ?3)
             WHERE id = ?1
               AND ?4 = 0
               AND ?5 <= ?6
               AND (?7 IS NULL OR ?6 < ?7)`,
          )
          .bind(
            period.employmentPeriodId,
            period.status === "active" ? "ACTIVE" : "ON_LEAVE",
            period.recordedAt * 1_000,
            period.isVoid ? 1 : 0,
            period.startsOn,
            businessDate,
            period.endsOn,
          ),
      ]
    }
    case "assignment": {
      const period = mutation.after
      return [
        db
          .prepare(
            `INSERT INTO company_organization_assignment_period_versions
             (period_id, revision, employment_id, employee_id, organization_unit_id,
              assignment_type, position_title, manager_employee_id, starts_on, ends_on,
              is_void, recorded_by_action_id, recorded_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
          )
          .bind(
            period.periodId,
            period.revision,
            period.employmentPeriodId,
            period.employeeId,
            toWorkforceOrganizationUnitId(period.departmentCode),
            period.assignmentType === "primary" ? "PRIMARY" : "CONCURRENT",
            period.positionTitle,
            period.managerEmployeeId,
            period.startsOn,
            period.endsOn,
            period.isVoid ? 1 : 0,
            period.recordedByActionId,
            period.recordedAt * 1_000,
          ),
      ]
    }
    case "responsibility": {
      const period = mutation.after
      return [
        db
          .prepare(
            `INSERT INTO company_organization_responsibility_period_versions
             (period_id, revision, employment_id, employee_id, organization_unit_id,
              responsibility_type,
              starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'MANAGER', ?6, ?7, ?8, ?9, ?10)`,
          )
          .bind(
            period.periodId,
            period.revision,
            period.employmentId,
            period.employeeId,
            toWorkforceOrganizationUnitId(period.departmentCode),
            period.startsOn,
            period.endsOn,
            period.isVoid ? 1 : 0,
            period.recordedByActionId,
            period.recordedAt * 1_000,
          ),
      ]
    }
  }
}

function organizationMutations(
  mutations: ReadonlyArray<LifecycleVersionMutation>,
): ReadonlyArray<LifecycleVersionMutation> {
  return mutations.filter(
    (mutation) => mutation.periodType === "assignment" || mutation.periodType === "responsibility",
  )
}

function orderedMutations(
  mutations: ReadonlyArray<LifecycleVersionMutation>,
): ReadonlyArray<LifecycleVersionMutation> {
  const closingOrder = { responsibility: 0, assignment: 1, status: 2, employment: 3 } as const
  const openingOrder = { employment: 4, status: 5, assignment: 6, responsibility: 7 } as const
  const orderOf = (mutation: LifecycleVersionMutation): number => {
    const closesPeriod = mutation.after.isVoid || mutation.after.endsOn !== null
    return closesPeriod ? closingOrder[mutation.periodType] : openingOrder[mutation.periodType]
  }

  return mutations.toSorted((left, right) => {
    const typeOrder = orderOf(left) - orderOf(right)
    if (typeOrder !== 0) return typeOrder

    // 訂正では競合する新旧期間を一つのoperation内で差し替える。
    // DBの各statementでも不変条件を保てるよう、無効化、既存期間更新、新規期間の順にする。
    // 退職時は配属・責務を先に閉じてから雇用を閉じ、採用時は雇用を先に開く。
    const phase = (mutation: LifecycleVersionMutation): number => {
      if (mutation.after.isVoid) return 0
      if (mutation.before !== null) return 1
      return 2
    }
    const phaseOrder = phase(left) - phase(right)
    if (phaseOrder !== 0) return phaseOrder

    if (left.after.periodId === right.after.periodId) {
      return left.after.revision - right.after.revision
    }
    return 0
  })
}

function toSafeAuditState(
  state: CurrentLifecycleProjection,
  employeeRevision: number,
  organizationRevision: number,
) {
  return {
    status: state.status,
    departmentCode: state.departmentCode,
    assignmentType: state.assignmentType,
    positionTitle: state.positionTitle,
    managerEmployeeCode: state.managerEmployeeCode,
    employeeRevision,
    organizationRevision,
  }
}

function unexpected(cause: unknown): CompanyOperationError {
  if (cause instanceof CompanyOperationError) {
    return cause
  }

  return new CompanyUnexpectedError("人事発令の確定に失敗しました", { cause })
}

export type PersonnelActionPersistenceProps = {
  command: DirectPersonnelActionCommand
  action: PersonnelActionRecord
  projection: PersonnelActionProjection
  scheduleBefore: LifecycleSchedule
  businessDate: string
  employeeCodes: ReadonlyMap<EmployeeId, string>
  revisions: { employeeRevision: number; organizationRevision: number }
  prospectiveEmployee?: { code: string; name: string }
}

function preparePersistenceStatements(
  c: CompanyContext,
  props: PersonnelActionPersistenceProps,
): D1PreparedStatement[] | CompanyOperationError {
  const db = c.env.DB
  const nextEmployeeRevision = props.revisions.employeeRevision + 1
  const canonicalMutations = organizationMutations(props.projection.mutations)
  const persistenceMutations = orderedMutations(props.projection.mutations)
  const nextOrganizationRevision = props.revisions.organizationRevision + canonicalMutations.length
  const before = currentProjection(props.scheduleBefore, props.businessDate, props.employeeCodes)
  const after = currentProjection(
    props.projection.schedule,
    props.businessDate,
    props.employeeCodes,
  )
  const audit = createCompanySystemAuditEvent({
    actorAccountId: props.command.session.accountId,
    actorEmployeeId: props.command.session.employeeId,
    action:
      props.action.kind === "corrected"
        ? "employee.lifecycle.corrected"
        : "employee.lifecycle.applied",
    targetType: "employee",
    targetId: String(props.action.employeeId),
    outcome: "succeeded",
    reasonCode: null,
    authorization:
      props.action.sourceType === "application"
        ? { workflowTask: true, applicationId: props.action.sourceApplicationId }
        : { permission: "employee:lifecycle:apply" },
    before: toSafeAuditState(
      before,
      props.revisions.employeeRevision,
      props.revisions.organizationRevision,
    ),
    after: toSafeAuditState(after, nextEmployeeRevision, nextOrganizationRevision),
    metadata: { actionKind: props.action.kind, effectiveOn: props.action.eventOn },
    occurredAt: new Date(props.action.recordedAt * 1_000),
    requestAudit: c.var.auditContext,
  })
  if (audit instanceof Error) {
    return new CompanyUnexpectedError("人事発令の監査イベントを作成できません", { cause: audit })
  }
  const statements: Array<D1PreparedStatement> = []

  if (props.prospectiveEmployee !== undefined) {
    statements.push(
      db
        .prepare(
          `INSERT INTO company_employees
             (id, official_name, employee_code, email, phone, created_at, updated_at)
           VALUES (?1, ?2, ?3, NULL, NULL, ?4, ?4)
           RETURNING id`,
        )
        .bind(
          props.action.employeeId,
          props.prospectiveEmployee.name,
          props.prospectiveEmployee.code,
          props.action.recordedAt * 1_000,
        ),
      new AbortWhenPreviousStatementChangedNoRowsAdapter(
        db,
      ).abortWhenPreviousStatementChangedNoRows(),
    )
  }

  if (props.projection.affectsOrganization) {
    statements.push(
      db
        .prepare(
          `INSERT INTO company_organization_change_operations
             (id, expected_revision, change_count, applied_count,
              resulting_revision, status, recorded_at, actor_account_id,
              reason, evidence_references_json)
           VALUES (?1, ?2, ?3, 0, ?2 + ?3, 'PENDING', ?4, ?5, ?6, ?7)`,
        )
        .bind(
          props.action.id,
          props.revisions.organizationRevision,
          canonicalMutations.length,
          props.action.recordedAt * 1_000,
          String(props.command.session.accountId),
          `personnel_action:${props.action.kind}`,
          stableLifecycleJson([
            {
              context: "company",
              kind: "personnel_action",
              id: props.action.id,
              version: String(nextEmployeeRevision),
            },
          ]),
        ),
    )
  }

  statements.push(
    db
      .prepare(
        `INSERT OR IGNORE INTO company_employee_lifecycle_revisions
           (employee_id, revision, updated_at) VALUES (?1, 0, ?2)`,
      )
      .bind(props.action.employeeId, props.action.recordedAt),
    db
      .prepare(
        `UPDATE company_employee_lifecycle_revisions
         SET revision = revision + 1, updated_at = ?1
         WHERE employee_id = ?2 AND revision = ?3`,
      )
      .bind(props.action.recordedAt, props.action.employeeId, props.revisions.employeeRevision),
    new AbortWhenPreviousStatementChangedNoRowsAdapter(
      db,
    ).abortWhenPreviousStatementChangedNoRows(),
  )

  statements.push(
    db
      .prepare(
        `INSERT INTO company_personnel_actions
           (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
            requested_by_employee_id, source_type, source_application_id,
            corrects_action_id, operation_id, payload_fingerprint, summary_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
      )
      .bind(
        props.action.id,
        props.action.employeeId,
        props.action.kind,
        props.action.eventOn,
        props.action.recordedAt,
        props.action.recordedByAccountId,
        props.action.requestedByEmployeeId,
        props.action.sourceType,
        props.action.sourceApplicationId,
        props.action.correctsActionId,
        props.action.operationId,
        props.action.payloadFingerprint,
        stableLifecycleJson(props.action.summary),
      ),
    new AbortWhenPreviousStatementChangedNoRowsAdapter(
      db,
    ).abortWhenPreviousStatementChangedNoRows(),
    ...persistenceMutations.flatMap((mutation) =>
      mutationStatements(db, mutation, props.businessDate),
    ),
  )

  if (props.projection.affectsOrganization) {
    statements.push(
      db
        .prepare(
          `UPDATE company_organization_change_operations
           SET status = 'COMPLETED'
           WHERE id = ?1 AND status = 'PENDING'`,
        )
        .bind(props.action.id),
      new AbortWhenPreviousStatementChangedNoRowsAdapter(
        db,
      ).abortWhenPreviousStatementChangedNoRows(),
    )
  }

  if (props.action.kind === "hire" || props.action.kind === "retired") {
    statements.push(
      db
        .prepare(
          `INSERT INTO company_lifecycle_outbox_entries
             (personnel_action_id, effect_type, payload_json, attempt_count,
              next_attempt_at, processed_at, last_error_code, created_at)
           VALUES (?1, ?2, ?3, 0, ?4, NULL, NULL, ?4)`,
        )
        .bind(
          props.action.id,
          props.action.kind,
          stableLifecycleJson({ actionId: props.action.id, employeeId: props.action.employeeId }),
          props.action.recordedAt,
        ),
    )
  }

  statements.push(...new SystemAuditEventRepository({ env: { DB: c.env.DB } }).prepareAppend(audit))
  return statements
}
type Context = CompanyContext

export class PersonnelActionPersistenceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(props: PersonnelActionPersistenceProps): D1PreparedStatement[] | CompanyOperationError {
    return preparePersistenceStatements(this.c, props)
  }

  async write(props: PersonnelActionPersistenceProps): Promise<true | CompanyOperationError> {
    const statements = this.prepare(props)
    if (statements instanceof CompanyOperationError) return statements

    try {
      const results = await this.c.env.DB.batch(statements)

      if (results.length !== statements.length || results.some((result) => !result.success)) {
        throw new Error("employee lifecycle batch did not succeed")
      }

      return true
    } catch (cause) {
      if (isAbortedByGuard(cause)) {
        return new CompanyConflictError("人事情報が同時に更新されました", "personnel_action_stale")
      }

      return unexpected(cause)
    }
  }

  async executeAuthorized(
    props: Readonly<{
      authorization: ExecutionAuthorizationEntity
      proposalDigest: ProposalDigest
      executedAt: Date
      persistence: PersonnelActionPersistenceProps
      request: Readonly<{ id: string; applicationId: number }>
    }>,
  ): Promise<true | CompanyOperationError | Error> {
    const statements = this.prepare(props.persistence)
    if (statements instanceof CompanyOperationError) return statements

    return new SystemD1AuthorizedExecutionAdapter({
      env: { DB: this.c.env.DB },
    }).execute({
      authorization: props.authorization,
      proposalDigest: props.proposalDigest,
      executedAt: props.executedAt,
      operationStatements: [
        ...statements,
        this.c.env.DB.prepare(
          `UPDATE company_personnel_action_requests
             SET applied_action_id = ?2, target_employee_id = ?4
             WHERE id = ?1 AND application_id = ?3
               AND applied_action_id IS NULL AND withdrawn_at IS NULL`,
        ).bind(
          props.request.id,
          props.persistence.action.id,
          props.request.applicationId,
          props.persistence.action.employeeId,
        ),
        new AbortWhenPreviousStatementChangedNoRowsAdapter(
          this.c.env.DB,
        ).abortWhenPreviousStatementChangedNoRows(),
      ],
    })
  }
}
