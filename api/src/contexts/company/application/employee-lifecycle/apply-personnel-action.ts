import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { createCompanySystemAuditEvent } from "@/contexts/company/infrastructure/audit/create-company-system-audit-event.repository"
import { containsDate } from "@/contexts/company/domain/definitions/contains-date.definition"
import type {
  LifecycleSchedule,
  LifecycleVersionMutation,
} from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import {
  projectPersonnelAction,
  type PersonnelActionProjection,
} from "@/contexts/company/domain/policies/project-personnel-action.policy"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { fingerprintPersonnelAction } from "@/contexts/company/domain/definitions/fingerprint-personnel-action.definition"
import { stableLifecycleJson } from "@/contexts/company/domain/definitions/stable-lifecycle-json.definition"
import type {
  OrganizationChangeSet,
  WorkforceSnapshotReadPort,
} from "@/contexts/company/domain/definitions/organization-change.definition"
import { ValidateOrganizationChange } from "@/contexts/company/infrastructure/workforce/validate-organization-change.repository"
import { toWorkforceLifecycleSchedules } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreOrgResponsibilityType } from "@/contexts/company/domain/definitions/restore-org-responsibility-type.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event.repository"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle.repository"
import {
  PersonnelActionRepository,
  type PersonnelActionRecord,
} from "@/contexts/company/infrastructure/employee-lifecycle/personnel-action.repository"
import { OrganizationUnitReadRepository } from "@/contexts/company/infrastructure/workforce/organization-unit-read.repository"
import { OrganizationWorkforceSnapshotRepository } from "@/contexts/company/infrastructure/workforce/organization-workforce-snapshot.repository"
import { abortWhenPreviousStatementChangedNoRows } from "@/contexts/company/infrastructure/database/abort-when-previous-statement-changed-no-rows.repository"
import { isAbortedByGuard } from "@/contexts/company/infrastructure/database/is-aborted-by-guard.repository"
import {
  CompanyOperationError,
  CompanyConflictError,
  CompanyForbiddenError,
  CompanyUnexpectedError,
  CompanyUnavailableError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { z } from "zod"

export type DirectPersonnelActionCommand = {
  session: CompanyPersonnelSession
  employeeId: number
  input: PersonnelActionInput
  idempotencyKey: string
  expectedEmployeeRevision: number
  expectedOrganizationRevision: number | null
}

type CurrentLifecycleProjection = {
  status: "active" | "leave" | "retired"
  departmentCode: string | null
  assignmentType: "primary" | null
  positionTitle: string | null
  managerEmployeeId: number | null
  managerEmployeeCode: string | null
}

const idempotencyKeySchema = z.string().min(1).max(200)
const revisionSchema = z.number().int().nonnegative()

export type PreparedPersonnelActionCompletion = {
  action: PersonnelActionRecord
  statements: ReadonlyArray<D1PreparedStatement>
}

function actionEventOn(input: PersonnelActionInput): string {
  return input.kind === "retired" ? input.retirementOn : input.eventOn
}

function currentProjection(
  schedule: LifecycleSchedule,
  date: string,
  employeeCodes: ReadonlyMap<number, string>,
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
    (period) => period.employmentPeriodId === employment.periodId && containsDate(period, date),
  )
  const primary = schedule.assignments.find(
    (period) =>
      period.employmentPeriodId === employment.periodId &&
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

function mutationStatement(
  db: D1Database,
  mutation: LifecycleVersionMutation,
): D1PreparedStatement {
  switch (mutation.periodType) {
    case "employment": {
      const period = mutation.after
      return db
        .prepare(
          `INSERT INTO employment_period_versions
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
        )
    }
    case "status": {
      const period = mutation.after
      return db
        .prepare(
          `INSERT INTO employee_status_period_versions
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
        )
    }
    case "assignment": {
      const period = mutation.after
      return db
        .prepare(
          `INSERT INTO employee_org_assignment_period_versions
             (period_id, revision, employment_period_id, employee_id, department_code,
              assignment_type, position_title, manager_employee_id, starts_on, ends_on,
              is_void, recorded_by_action_id, recorded_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
        )
        .bind(
          period.periodId,
          period.revision,
          period.employmentPeriodId,
          period.employeeId,
          period.departmentCode,
          period.assignmentType,
          period.positionTitle,
          period.managerEmployeeId,
          period.startsOn,
          period.endsOn,
          period.isVoid ? 1 : 0,
          period.recordedByActionId,
          period.recordedAt,
        )
    }
    case "responsibility": {
      const period = mutation.after
      return db
        .prepare(
          `INSERT INTO employee_org_responsibility_period_versions
             (period_id, revision, department_code, responsibility_type, employee_id,
              starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
        )
        .bind(
          period.periodId,
          period.revision,
          period.departmentCode,
          period.responsibilityType,
          period.employeeId,
          period.startsOn,
          period.endsOn,
          period.isVoid ? 1 : 0,
          period.recordedByActionId,
          period.recordedAt,
        )
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
  const order = { employment: 0, status: 1, assignment: 2, responsibility: 3 } as const
  return mutations.toSorted((left, right) => {
    const typeOrder = order[left.periodType] - order[right.periodType]
    if (typeOrder !== 0) return typeOrder

    // 訂正では競合する新旧期間を一つのoperation内で差し替える。
    // DBの各statementでも不変条件を保てるよう、無効化、既存期間更新、新規期間の順にする。
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

function containsPeriod(
  container: Readonly<{ startsOn: string; endsOn: string | null }>,
  period: Readonly<{ startsOn: string; endsOn: string | null }>,
): boolean {
  return (
    container.startsOn <= period.startsOn &&
    (container.endsOn === null || (period.endsOn !== null && period.endsOn <= container.endsOn))
  )
}

function canonicalOrganizationChange(props: {
  actionId: string
  expectedRevision: number
  businessDate: string
  recordedAt: number
  actorAccountId: string
  reason: string
  evidenceReferences: OrganizationChangeSet["evidenceReferences"]
  projection: PersonnelActionProjection
}): OrganizationChangeSet | CompanyOperationError {
  try {
    const operationId = restoreWorkforceId("personnel_action", props.actionId)
    const assignments: OrganizationChangeSet["assignments"][number][] = []
    const responsibilities: OrganizationChangeSet["responsibilities"][number][] = []

    for (const mutation of props.projection.mutations) {
      if (mutation.periodType === "assignment") {
        const period = mutation.after
        assignments.push({
          periodId: restoreWorkforceId("period", `assignment-period:${period.periodId}`),
          revision: period.revision,
          employmentId: restoreWorkforceId("employment", `employment:${period.employmentPeriodId}`),
          employeeId: restoreWorkforceId("employee", `employee:${period.employeeId}`),
          organizationUnitId: restoreWorkforceId(
            "organization_unit",
            `department:${period.departmentCode}`,
          ),
          assignmentType: period.assignmentType === "primary" ? "PRIMARY" : "CONCURRENT",
          positionTitle: period.positionTitle,
          managerEmployeeId:
            period.managerEmployeeId === null
              ? null
              : restoreWorkforceId("employee", `employee:${period.managerEmployeeId}`),
          startsOn: restoreCalendarDate(period.startsOn),
          endsOn: period.endsOn === null ? null : restoreCalendarDate(period.endsOn),
          isVoid: period.isVoid,
          recordedByActionId: operationId,
          recordedAt: props.recordedAt,
        })
        continue
      }
      if (mutation.periodType !== "responsibility") continue

      const period = mutation.after
      const employment = props.projection.schedule.employments.find(
        (candidate) =>
          candidate.employeeId === period.employeeId && containsPeriod(candidate, period),
      )
      if (employment === undefined) {
        return new CompanyValidationError(
          "組織責務に対応する雇用期間がありません",
          "personnel_action_invalid_transition",
        )
      }
      responsibilities.push({
        periodId: restoreWorkforceId("period", `responsibility-period:${period.periodId}`),
        revision: period.revision,
        employmentId: restoreWorkforceId("employment", `employment:${employment.periodId}`),
        employeeId: restoreWorkforceId("employee", `employee:${period.employeeId}`),
        organizationUnitId: restoreWorkforceId(
          "organization_unit",
          `department:${period.departmentCode}`,
        ),
        responsibilityType: restoreOrgResponsibilityType("MANAGER"),
        startsOn: restoreCalendarDate(period.startsOn),
        endsOn: period.endsOn === null ? null : restoreCalendarDate(period.endsOn),
        isVoid: period.isVoid,
        recordedByActionId: operationId,
        recordedAt: props.recordedAt,
      })
    }

    return {
      operationId,
      expectedRevision: props.expectedRevision,
      asOf: restoreCalendarDate(props.businessDate),
      recordedAt: props.recordedAt,
      actorAccountId: props.actorAccountId,
      reason: props.reason,
      evidenceReferences: props.evidenceReferences,
      organizationUnits: [],
      unitPeriods: [],
      assignments,
      responsibilities,
    }
  } catch (cause) {
    return new CompanyValidationError(
      "組織変更を共通形式へ変換できません",
      "personnel_action_invalid_transition",
      { cause },
    )
  }
}

async function validateCanonicalOrganizationChange(
  c: CompanyContext,
  props: Parameters<typeof canonicalOrganizationChange>[0] &
    Readonly<{
      prospectiveEmployee?: Readonly<{ id: number; code: string; name: string }>
    }>,
): Promise<CompanyOperationError | null> {
  const change = canonicalOrganizationChange(props)
  if (change instanceof CompanyOperationError) return change

  const currentWorkforce = new OrganizationWorkforceSnapshotRepository(c)
  const prospectiveEmployee = props.prospectiveEmployee
  const workforce: WorkforceSnapshotReadPort =
    prospectiveEmployee === undefined
      ? currentWorkforce
      : {
          async readAllSnapshot() {
            const current = await currentWorkforce.readAllSnapshot()
            if (!current.ok) return current

            const employeeId = restoreWorkforceId("employee", `employee:${prospectiveEmployee.id}`)
            const lifecycle = toWorkforceLifecycleSchedules([props.projection.schedule]).find(
              (schedule) => schedule.employeeId === employeeId,
            )
            if (lifecycle === undefined) {
              return {
                ok: false as const,
                cause: new Error("prospective employee lifecycle was not projected"),
              }
            }

            // 採用確定前のEmployeeはDB snapshotにまだ存在しない。
            // 同一transactionで追加するprofile・雇用・状態だけを検証前snapshotへ補い、
            // 所属と責務はOrganizationChangeSetを一度だけ適用して検証する。
            return {
              ok: true as const,
              schedules: [
                ...current.schedules,
                {
                  employee: {
                    id: employeeId,
                    officialName: prospectiveEmployee.name,
                    employeeCode: prospectiveEmployee.code,
                    email: null,
                    phone: null,
                  },
                  employments: lifecycle.employments,
                  statuses: lifecycle.statuses,
                  assignments: [],
                  responsibilities: [],
                  accountLink: null,
                },
              ],
            }
          },
        }

  const result = await new ValidateOrganizationChange({
    organization: new OrganizationUnitReadRepository(c.var.database),
    workforce,
  }).execute(change)
  if (result.kind === "valid") return null
  if (result.kind === "conflict") {
    return new CompanyConflictError("組織情報が更新されています", "personnel_action_stale")
  }
  if (result.kind === "operation_conflict") {
    return new CompanyConflictError("組織変更IDが再利用されています", "personnel_action_stale")
  }
  if (result.kind === "invalid") {
    return new CompanyValidationError(
      "人事発令後の組織状態が不正です",
      "personnel_action_invalid_transition",
      { cause: result.error },
    )
  }
  return new CompanyUnavailableError(
    "組織変更を安全に検証できません",
    "organization_change_unavailable",
    {
      cause: result.cause,
    },
  )
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

type PersistenceProps = {
  command: DirectPersonnelActionCommand
  action: PersonnelActionRecord
  projection: PersonnelActionProjection
  scheduleBefore: LifecycleSchedule
  businessDate: string
  employeeCodes: ReadonlyMap<number, string>
  revisions: { employeeRevision: number; organizationRevision: number }
  prospectiveEmployee?: { code: string; name: string }
}

function preparePersistenceStatements(
  c: CompanyContext,
  props: PersistenceProps,
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
          `INSERT INTO employees
             (id, code, name, dept_id, dept_name, position, status,
              archived_at, archived_by_account_id)
           VALUES (?1, ?2, ?3, NULL, NULL, NULL, ?4, NULL, NULL)
           RETURNING id`,
        )
        .bind(
          props.action.employeeId,
          props.prospectiveEmployee.code,
          props.prospectiveEmployee.name,
          after.status,
        ),
      abortWhenPreviousStatementChangedNoRows(db),
    )
  }

  if (props.projection.affectsOrganization) {
    statements.push(
      db
        .prepare(
          `INSERT INTO organization_change_operations
             (id, expected_revision, change_count, applied_count,
              resulting_revision, status, recorded_at, actor_account_id,
              reason, evidence_references_json)
           VALUES (?1, ?2, ?3, 0, ?2 + ?3, 'PENDING', ?4, ?5, ?6, ?7)`,
        )
        .bind(
          props.action.id,
          props.revisions.organizationRevision,
          canonicalMutations.length,
          props.action.recordedAt,
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
        `INSERT OR IGNORE INTO employee_lifecycle_revisions
           (employee_id, revision, updated_at) VALUES (?1, 0, ?2)`,
      )
      .bind(props.action.employeeId, props.action.recordedAt),
    db
      .prepare(
        `UPDATE employee_lifecycle_revisions
         SET revision = revision + 1, updated_at = ?1
         WHERE employee_id = ?2 AND revision = ?3`,
      )
      .bind(props.action.recordedAt, props.action.employeeId, props.revisions.employeeRevision),
    abortWhenPreviousStatementChangedNoRows(db),
  )

  statements.push(
    db
      .prepare(
        `INSERT INTO personnel_actions
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
    abortWhenPreviousStatementChangedNoRows(db),
    ...persistenceMutations.map((mutation) => mutationStatement(db, mutation)),
    db
      .prepare(
        `UPDATE employees
         SET dept_id = (
               SELECT organization.department_id FROM org_departments AS organization
               WHERE organization.code = ?1
             ),
             dept_name = (
               SELECT department.name
               FROM org_departments AS organization
               INNER JOIN departments AS department ON department.id = organization.department_id
               WHERE organization.code = ?1
             ),
             position = ?2,
             status = ?3
         WHERE id = ?4`,
      )
      .bind(after.departmentCode, after.positionTitle, after.status, props.action.employeeId),
    abortWhenPreviousStatementChangedNoRows(db),
  )

  if (props.projection.affectsOrganization) {
    statements.push(
      db
        .prepare(
          `UPDATE organization_change_operations
           SET status = 'COMPLETED'
           WHERE id = ?1 AND status = 'PENDING'`,
        )
        .bind(props.action.id),
      abortWhenPreviousStatementChangedNoRows(db),
    )
  }

  if (props.projection.affectsOrganization) {
    const currentAssignments = props.projection.schedule.assignments.filter((assignment) =>
      containsDate(assignment, props.businessDate),
    )
    const employeeCode = props.employeeCodes.get(props.action.employeeId)

    statements.push(
      db.prepare("DELETE FROM org_memberships WHERE employee_code = ?1").bind(employeeCode ?? ""),
      ...currentAssignments.map((assignment) =>
        db
          .prepare(
            `INSERT OR REPLACE INTO org_memberships
               (department_code, employee_code, manager_employee_code)
             VALUES (?1, ?2, ?3)`,
          )
          .bind(
            assignment.departmentCode,
            employeeCode ?? "",
            assignment.managerEmployeeId === null
              ? null
              : (props.employeeCodes.get(assignment.managerEmployeeId) ?? null),
          ),
      ),
    )
  }

  if (props.action.kind === "hire" || props.action.kind === "retired") {
    statements.push(
      db
        .prepare(
          `INSERT INTO lifecycle_outbox_entries
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

export class ApplyPersonnelAction {
  constructor(private readonly c: CompanyContext) {
    Object.freeze(this)
  }

  async run(
    command: DirectPersonnelActionCommand,
  ): Promise<{ action: PersonnelActionRecord; replayed: boolean } | CompanyOperationError> {
    if (!command.session.hasPermission("employee:lifecycle:apply")) {
      return new CompanyForbiddenError("人事発令を確定する権限がありません", "forbidden")
    }

    const operationResult = idempotencyKeySchema.safeParse(command.idempotencyKey)
    const employeeRevisionResult = revisionSchema.safeParse(command.expectedEmployeeRevision)
    const organizationRevisionResult = z
      .union([revisionSchema, z.null()])
      .safeParse(command.expectedOrganizationRevision)

    if (
      !operationResult.success ||
      !employeeRevisionResult.success ||
      !organizationRevisionResult.success
    ) {
      return new CompanyValidationError(
        "人事発令の競合制御入力が不正です",
        "personnel_action_stale",
      )
    }

    const fingerprint = await fingerprintPersonnelAction(command.employeeId, command.input)
    const actionRepository = new PersonnelActionRepository(this.c)
    const existing = await actionRepository.findByOperationId(command.idempotencyKey)

    if (existing instanceof CompanyOperationError) {
      return existing
    }

    if (existing !== null) {
      return this.classifyReplay(existing, command, fingerprint)
    }

    const lifecycleRepository = new EmployeeLifecycleRepository(this.c)

    const now = this.c.env.NOW ?? new Date().toISOString()
    const businessDate = resolveCompanyBusinessDate({
      now,
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })

    if (typeof businessDate !== "string") {
      return new CompanyUnavailableError(
        "会社営業日を解決できません",
        "company_timezone_unavailable",
        {
          cause: businessDate,
        },
      )
    }

    const [schedule, organizationSchedules, references, revisions] = await Promise.all([
      lifecycleRepository.loadSchedule(command.employeeId),
      lifecycleRepository.loadOrganizationSchedules(),
      lifecycleRepository.loadReferences(),
      lifecycleRepository.loadRevisions(command.employeeId),
    ])

    for (const result of [schedule, organizationSchedules, references, revisions]) {
      if (result instanceof CompanyOperationError) {
        return result
      }
    }

    const loadedSchedule = schedule as LifecycleSchedule
    const loadedOrganizationSchedules = organizationSchedules as ReadonlyArray<LifecycleSchedule>
    const loadedReferences = references as Exclude<typeof references, CompanyOperationError>
    const loadedRevisions = revisions as Exclude<typeof revisions, CompanyOperationError>

    if (loadedRevisions.employeeRevision !== command.expectedEmployeeRevision) {
      return new CompanyConflictError(
        "従業員の人事情報が更新されています",
        "personnel_action_stale",
      )
    }

    const target = loadedReferences.employees.find((employee) => employee.id === command.employeeId)
    const commandEmployeeCode =
      command.input.kind === "corrected"
        ? command.input.replacementAction.employeeCode
        : command.input.employeeCode

    if (target === undefined || target.code !== commandEmployeeCode) {
      return new CompanyValidationError(
        "対象従業員が一致しません",
        "personnel_action_invalid_transition",
      )
    }

    let correction:
      | {
          mutations: ReadonlyArray<LifecycleVersionMutation>
          alreadyCorrected: boolean
        }
      | undefined

    if (command.input.kind === "corrected") {
      const [mutations, alreadyCorrected, original] = await Promise.all([
        actionRepository.loadMutationsForAction(command.input.correctsActionId),
        actionRepository.hasCorrection(command.input.correctsActionId),
        actionRepository.findById(command.input.correctsActionId),
      ])

      if (
        mutations instanceof CompanyOperationError ||
        alreadyCorrected instanceof CompanyOperationError ||
        original instanceof CompanyOperationError
      ) {
        return [mutations, alreadyCorrected, original].find(
          (result): result is CompanyOperationError => result instanceof CompanyOperationError,
        ) as CompanyOperationError
      }

      if (original === null || original.employeeId !== command.employeeId) {
        return new CompanyValidationError(
          "訂正対象の人事発令が見つかりません",
          "personnel_action_invalid_transition",
        )
      }

      correction = { mutations, alreadyCorrected }
    }

    const actionId = crypto.randomUUID()
    const recordedAt = Math.floor(Date.parse(now) / 1_000)
    const projected = projectPersonnelAction({
      schedule: loadedSchedule,
      organizationSchedules: loadedOrganizationSchedules,
      departments: loadedReferences.departments,
      employees: loadedReferences.employees,
      command: {
        actionId,
        employeeId: command.employeeId,
        recordedAt,
        input: command.input,
        correction,
      },
    })

    if (projected instanceof CompanyOperationError) {
      return projected
    }

    if (
      projected.affectsOrganization &&
      command.expectedOrganizationRevision !== loadedRevisions.organizationRevision
    ) {
      return new CompanyConflictError("組織情報が更新されています", "personnel_action_stale")
    }
    if (projected.affectsOrganization) {
      const validation = await validateCanonicalOrganizationChange(this.c, {
        actionId,
        expectedRevision: loadedRevisions.organizationRevision,
        businessDate,
        recordedAt,
        actorAccountId: String(command.session.accountId),
        reason: `personnel_action:${command.input.kind}`,
        evidenceReferences: [
          {
            context: "company",
            kind: "personnel_action",
            id: actionId,
            version: String(loadedRevisions.employeeRevision + 1),
          },
        ],
        projection: projected,
      })
      if (validation !== null) return validation
    }

    const action: PersonnelActionRecord = {
      id: actionId,
      employeeId: command.employeeId,
      kind: command.input.kind,
      eventOn: actionEventOn(command.input),
      recordedAt,
      recordedByAccountId: command.session.accountId,
      requestedByEmployeeId: command.session.employeeId,
      sourceType: "direct",
      sourceApplicationId: null,
      correctsActionId: command.input.kind === "corrected" ? command.input.correctsActionId : null,
      operationId: command.idempotencyKey,
      payloadFingerprint: fingerprint,
      summary: projected.summary,
    }

    return this.persist({
      command,
      action,
      projection: projected,
      scheduleBefore: loadedSchedule,
      businessDate,
      employeeCodes: new Map(
        loadedReferences.employees.map((employee) => [employee.id, employee.code]),
      ),
      revisions: loadedRevisions,
    })
  }

  async prepareApplicationCompletion(command: {
    session: CompanyPersonnelSession
    employeeId: number | null
    input: PersonnelActionInput
    sourceApplicationId: number | null
    idempotencyKey?: string
    requestedByEmployeeId: number
    expectedEmployeeRevision: number
    expectedOrganizationRevision: number | null
    expectedPayloadFingerprint: string
  }): Promise<PreparedPersonnelActionCompletion | CompanyOperationError> {
    const employeeRevisionResult = revisionSchema.safeParse(command.expectedEmployeeRevision)
    const organizationRevisionResult = z
      .union([revisionSchema, z.null()])
      .safeParse(command.expectedOrganizationRevision)
    if (!employeeRevisionResult.success || !organizationRevisionResult.success) {
      return new CompanyValidationError(
        "人事発令の競合制御入力が不正です",
        "personnel_action_stale",
      )
    }
    if (command.employeeId === null && command.input.kind !== "hire") {
      return new CompanyValidationError(
        "対象従業員が一致しません",
        "personnel_action_invalid_transition",
      )
    }
    const prospectiveKey =
      command.input.kind === "hire" ? `prospective:${command.input.employeeCode}` : null
    const fingerprint = await fingerprintPersonnelAction(
      command.employeeId ?? prospectiveKey ?? "invalid",
      command.input,
    )
    if (fingerprint !== command.expectedPayloadFingerprint) {
      return new CompanyConflictError("申請内容の整合性を確認できません", "idempotency_conflict")
    }
    const operationId =
      command.sourceApplicationId === null
        ? command.idempotencyKey
        : `application:${command.sourceApplicationId}`
    if (operationId === undefined) {
      return new CompanyValidationError("冪等キーが必要です", "idempotency_conflict")
    }
    const actionRepository = new PersonnelActionRepository(this.c)
    const existing = await actionRepository.findByOperationId(operationId)
    if (existing instanceof CompanyOperationError) return existing
    if (existing !== null) {
      return new CompanyConflictError("申請はすでに人事発令へ反映されています", "already_decided")
    }

    const lifecycleRepository = new EmployeeLifecycleRepository(this.c)
    const now = this.c.env.NOW ?? new Date().toISOString()
    const businessDate = resolveCompanyBusinessDate({
      now,
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (typeof businessDate !== "string") {
      return new CompanyUnavailableError(
        "会社営業日を解決できません",
        "company_timezone_unavailable",
        {
          cause: businessDate,
        },
      )
    }
    const allocatedEmployeeId =
      command.employeeId ??
      (await this.c.env.DB.prepare("SELECT COALESCE(MAX(id), 0) + 1 FROM employees").first<number>(
        "COALESCE(MAX(id), 0) + 1",
      )) ??
      1
    const [schedule, organizationSchedules, references, revisions] = await Promise.all([
      lifecycleRepository.loadSchedule(allocatedEmployeeId),
      lifecycleRepository.loadOrganizationSchedules(),
      lifecycleRepository.loadReferences(),
      lifecycleRepository.loadRevisions(allocatedEmployeeId),
    ])
    for (const result of [schedule, organizationSchedules, references, revisions]) {
      if (result instanceof CompanyOperationError) return result
    }
    const loadedSchedule = schedule as LifecycleSchedule
    const loadedOrganizationSchedules = organizationSchedules as ReadonlyArray<LifecycleSchedule>
    const loadedReferences = references as Exclude<typeof references, CompanyOperationError>
    const effectiveReferences =
      command.employeeId === null && command.input.kind === "hire"
        ? {
            ...loadedReferences,
            employees: [
              ...loadedReferences.employees,
              { id: allocatedEmployeeId, code: command.input.employeeCode },
            ],
          }
        : loadedReferences
    const loadedRevisions = revisions as Exclude<typeof revisions, CompanyOperationError>
    if (loadedRevisions.employeeRevision !== command.expectedEmployeeRevision) {
      return new CompanyConflictError(
        "従業員の人事情報が更新されています",
        "personnel_action_stale",
      )
    }
    const target = effectiveReferences.employees.find(
      (employee) => employee.id === allocatedEmployeeId,
    )
    const commandEmployeeCode =
      command.input.kind === "corrected"
        ? command.input.replacementAction.employeeCode
        : command.input.employeeCode
    if (target === undefined || target.code !== commandEmployeeCode) {
      return new CompanyValidationError(
        "対象従業員が一致しません",
        "personnel_action_invalid_transition",
      )
    }
    let correction:
      | { mutations: ReadonlyArray<LifecycleVersionMutation>; alreadyCorrected: boolean }
      | undefined
    if (command.input.kind === "corrected") {
      const [mutations, alreadyCorrected, original] = await Promise.all([
        actionRepository.loadMutationsForAction(command.input.correctsActionId),
        actionRepository.hasCorrection(command.input.correctsActionId),
        actionRepository.findById(command.input.correctsActionId),
      ])
      if (
        mutations instanceof CompanyOperationError ||
        alreadyCorrected instanceof CompanyOperationError ||
        original instanceof CompanyOperationError
      ) {
        return [mutations, alreadyCorrected, original].find(
          (result): result is CompanyOperationError => result instanceof CompanyOperationError,
        ) as CompanyOperationError
      }
      if (original === null || original.employeeId !== allocatedEmployeeId) {
        return new CompanyValidationError(
          "訂正対象の人事発令が見つかりません",
          "personnel_action_invalid_transition",
        )
      }
      correction = { mutations, alreadyCorrected }
    }
    const actionId = crypto.randomUUID()
    const recordedAt = Math.floor(Date.parse(now) / 1_000)
    const projected = projectPersonnelAction({
      schedule: loadedSchedule,
      organizationSchedules: loadedOrganizationSchedules,
      departments: effectiveReferences.departments,
      employees: effectiveReferences.employees,
      command: {
        actionId,
        employeeId: allocatedEmployeeId,
        recordedAt,
        input: command.input,
        correction,
      },
    })
    if (projected instanceof CompanyOperationError) return projected
    if (
      projected.affectsOrganization &&
      command.expectedOrganizationRevision !== loadedRevisions.organizationRevision
    ) {
      return new CompanyConflictError("組織情報が更新されています", "personnel_action_stale")
    }
    if (projected.affectsOrganization) {
      const validation = await validateCanonicalOrganizationChange(this.c, {
        actionId,
        expectedRevision: loadedRevisions.organizationRevision,
        businessDate,
        recordedAt,
        actorAccountId: String(command.session.accountId),
        reason: `personnel_action:${command.input.kind}`,
        evidenceReferences: [
          {
            context: "company",
            kind: "personnel_action",
            id: actionId,
            version: String(loadedRevisions.employeeRevision + 1),
          },
        ],
        projection: projected,
        prospectiveEmployee:
          command.employeeId === null && command.input.kind === "hire"
            ? {
                id: allocatedEmployeeId,
                code: command.input.employeeCode,
                name: command.input.employeeName,
              }
            : undefined,
      })
      if (validation !== null) return validation
    }
    const action: PersonnelActionRecord = {
      id: actionId,
      employeeId: allocatedEmployeeId,
      kind: command.input.kind,
      eventOn: actionEventOn(command.input),
      recordedAt,
      recordedByAccountId: command.session.accountId,
      requestedByEmployeeId: command.requestedByEmployeeId,
      sourceType: command.sourceApplicationId === null ? "direct" : "application",
      sourceApplicationId: command.sourceApplicationId,
      correctsActionId: command.input.kind === "corrected" ? command.input.correctsActionId : null,
      operationId,
      payloadFingerprint: fingerprint,
      summary: projected.summary,
    }
    const persistenceCommand: DirectPersonnelActionCommand = {
      session: command.session,
      employeeId: allocatedEmployeeId,
      input: command.input,
      idempotencyKey: operationId,
      expectedEmployeeRevision: command.expectedEmployeeRevision,
      expectedOrganizationRevision: command.expectedOrganizationRevision,
    }
    const statements = preparePersistenceStatements(this.c, {
      command: persistenceCommand,
      action,
      projection: projected,
      scheduleBefore: loadedSchedule,
      businessDate,
      employeeCodes: new Map(
        effectiveReferences.employees.map((employee) => [employee.id, employee.code]),
      ),
      revisions: loadedRevisions,
      prospectiveEmployee:
        command.employeeId === null && command.input.kind === "hire"
          ? { code: command.input.employeeCode, name: command.input.employeeName }
          : undefined,
    })
    return statements instanceof CompanyOperationError ? statements : { action, statements }
  }

  async prepareDirectProspectiveHire(command: {
    session: CompanyPersonnelSession
    input: Extract<PersonnelActionInput, { kind: "hire" }>
    idempotencyKey: string
    expectedOrganizationRevision: number
  }): Promise<PreparedPersonnelActionCompletion | CompanyOperationError> {
    const fingerprint = await fingerprintPersonnelAction(
      `prospective:${command.input.employeeCode}`,
      command.input,
    )
    return this.prepareApplicationCompletion({
      session: command.session,
      employeeId: null,
      input: command.input,
      sourceApplicationId: null,
      idempotencyKey: command.idempotencyKey,
      requestedByEmployeeId: command.session.employeeId,
      expectedEmployeeRevision: 0,
      expectedOrganizationRevision: command.expectedOrganizationRevision,
      expectedPayloadFingerprint: fingerprint,
    })
  }

  private classifyReplay(
    existing: PersonnelActionRecord,
    command: DirectPersonnelActionCommand,
    fingerprint: string,
  ): { action: PersonnelActionRecord; replayed: true } | CompanyOperationError {
    if (
      existing.employeeId !== command.employeeId ||
      existing.recordedByAccountId !== command.session.accountId ||
      existing.requestedByEmployeeId !== command.session.employeeId ||
      existing.payloadFingerprint !== fingerprint ||
      existing.sourceType !== "direct"
    ) {
      return new CompanyConflictError(
        "冪等キーが別の人事発令に使われています",
        "idempotency_conflict",
      )
    }

    return { action: existing, replayed: true }
  }

  private async persist(
    props: PersistenceProps,
  ): Promise<{ action: PersonnelActionRecord; replayed: boolean } | CompanyOperationError> {
    const db = this.c.env.DB
    const statements = preparePersistenceStatements(this.c, props)
    if (statements instanceof CompanyOperationError) return statements

    try {
      const results = await db.batch(statements)

      if (results.length !== statements.length || results.some((result) => !result.success)) {
        throw new Error("employee lifecycle batch did not succeed")
      }

      return { action: props.action, replayed: false }
    } catch (cause) {
      if (isAbortedByGuard(cause)) {
        return new CompanyConflictError("人事情報が同時に更新されました", "personnel_action_stale")
      }

      const raced = await new PersonnelActionRepository(this.c).findByOperationId(
        props.action.operationId,
      )

      if (!(raced instanceof CompanyOperationError) && raced !== null) {
        const replay = this.classifyReplay(raced, props.command, props.action.payloadFingerprint)
        return replay
      }

      return unexpected(cause)
    }
  }
}
