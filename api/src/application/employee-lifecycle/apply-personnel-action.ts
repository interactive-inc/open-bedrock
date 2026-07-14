import { createAuditEvent } from "@/domain/audit/audit-event"
import {
  containsDate,
  type LifecycleSchedule,
  type LifecycleVersionMutation,
} from "@/domain/employee-lifecycle/lifecycle-schedule"
import {
  projectPersonnelAction,
  type PersonnelActionProjection,
} from "@/domain/employee-lifecycle/project-personnel-action"
import type { PersonnelActionInput } from "@/domain/employee-lifecycle/lifecycle-types"
import type { Context, SessionPayload } from "@/env"
import { AuditEventRepository } from "@/infrastructure/audit/audit-event-repository"
import { EmployeeLifecycleRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import {
  PersonnelActionRepository,
  type PersonnelActionRecord,
} from "@/infrastructure/employee-lifecycle/personnel-action-repository"
import { hasPermission } from "@/lib/auth/has-permission"
import {
  abortWhenPreviousStatementChangedNoRows,
  isAbortedByGuard,
} from "@/lib/d1/batch-abort-guard"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  UnexpectedError,
  UnavailableError,
  ValidationError,
} from "@/lib/errors"
import { resolveCompanyBusinessDate } from "@/lib/time/company-business-date"
import { z } from "zod"

export type DirectPersonnelActionCommand = {
  session: SessionPayload
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

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    )
  }

  return value
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
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
          `INSERT INTO org_assignment_period_versions
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
          `INSERT INTO org_responsibility_period_versions
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

function unexpected(cause: unknown): ApplicationError {
  if (cause instanceof ApplicationError) {
    return cause
  }

  return new UnexpectedError("人事発令の確定に失敗しました", { cause })
}

export class ApplyPersonnelAction {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(
    command: DirectPersonnelActionCommand,
  ): Promise<{ action: PersonnelActionRecord; replayed: boolean } | ApplicationError> {
    if (!hasPermission(command.session, "employee:lifecycle:apply")) {
      return new ForbiddenError("人事発令を確定する権限がありません", "forbidden")
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
      return new ValidationError("人事発令の競合制御入力が不正です", "personnel_action_stale")
    }

    const fingerprint = await sha256(
      stableJson({ employeeId: command.employeeId, input: command.input }),
    )
    const actionRepository = new PersonnelActionRepository(this.c)
    const existing = await actionRepository.findByOperationId(command.idempotencyKey)

    if (existing instanceof ApplicationError) {
      return existing
    }

    if (existing !== null) {
      return this.classifyReplay(existing, command, fingerprint)
    }

    const lifecycleRepository = new EmployeeLifecycleRepository(this.c)
    const migrationStatus = await lifecycleRepository.migrationStatus()

    if (migrationStatus instanceof ApplicationError) {
      return migrationStatus
    }

    if (migrationStatus !== "verified") {
      return new UnavailableError(
        "人事ライフサイクル移行が完了していません",
        "lifecycle_migration_incomplete",
      )
    }

    const now = this.c.env.NOW ?? new Date().toISOString()
    const businessDate = resolveCompanyBusinessDate({
      now,
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })

    if (typeof businessDate !== "string") {
      return new UnavailableError("会社営業日を解決できません", "company_timezone_unavailable", {
        cause: businessDate,
      })
    }

    const [schedule, organizationSchedules, references, revisions] = await Promise.all([
      lifecycleRepository.loadSchedule(command.employeeId),
      lifecycleRepository.loadOrganizationSchedules(),
      lifecycleRepository.loadReferences(),
      lifecycleRepository.loadRevisions(command.employeeId),
    ])

    for (const result of [schedule, organizationSchedules, references, revisions]) {
      if (result instanceof ApplicationError) {
        return result
      }
    }

    const loadedSchedule = schedule as LifecycleSchedule
    const loadedOrganizationSchedules = organizationSchedules as ReadonlyArray<LifecycleSchedule>
    const loadedReferences = references as Exclude<typeof references, ApplicationError>
    const loadedRevisions = revisions as Exclude<typeof revisions, ApplicationError>

    if (loadedRevisions.employeeRevision !== command.expectedEmployeeRevision) {
      return new ConflictError("従業員の人事情報が更新されています", "personnel_action_stale")
    }

    const target = loadedReferences.employees.find((employee) => employee.id === command.employeeId)
    const commandEmployeeCode =
      command.input.kind === "corrected"
        ? command.input.replacementAction.employeeCode
        : command.input.employeeCode

    if (target === undefined || target.code !== commandEmployeeCode) {
      return new ValidationError("対象従業員が一致しません", "personnel_action_invalid_transition")
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
        mutations instanceof ApplicationError ||
        alreadyCorrected instanceof ApplicationError ||
        original instanceof ApplicationError
      ) {
        return [mutations, alreadyCorrected, original].find(
          (result): result is ApplicationError => result instanceof ApplicationError,
        ) as ApplicationError
      }

      if (original === null || original.employeeId !== command.employeeId) {
        return new ValidationError(
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

    if (projected instanceof ApplicationError) {
      return projected
    }

    if (
      projected.affectsOrganization &&
      command.expectedOrganizationRevision !== loadedRevisions.organizationRevision
    ) {
      return new ConflictError("組織情報が更新されています", "personnel_action_stale")
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

  private classifyReplay(
    existing: PersonnelActionRecord,
    command: DirectPersonnelActionCommand,
    fingerprint: string,
  ): { action: PersonnelActionRecord; replayed: true } | ApplicationError {
    if (
      existing.employeeId !== command.employeeId ||
      existing.recordedByAccountId !== command.session.accountId ||
      existing.requestedByEmployeeId !== command.session.employeeId ||
      existing.payloadFingerprint !== fingerprint ||
      existing.sourceType !== "direct"
    ) {
      return new ConflictError("冪等キーが別の人事発令に使われています", "idempotency_conflict")
    }

    return { action: existing, replayed: true }
  }

  private async persist(props: {
    command: DirectPersonnelActionCommand
    action: PersonnelActionRecord
    projection: PersonnelActionProjection
    scheduleBefore: LifecycleSchedule
    businessDate: string
    employeeCodes: ReadonlyMap<number, string>
    revisions: { employeeRevision: number; organizationRevision: number }
  }): Promise<{ action: PersonnelActionRecord; replayed: boolean } | ApplicationError> {
    const db = this.c.env.DB
    const nextEmployeeRevision = props.revisions.employeeRevision + 1
    const nextOrganizationRevision =
      props.revisions.organizationRevision + (props.projection.affectsOrganization ? 1 : 0)
    const before = currentProjection(props.scheduleBefore, props.businessDate, props.employeeCodes)
    const after = currentProjection(
      props.projection.schedule,
      props.businessDate,
      props.employeeCodes,
    )
    const audit = createAuditEvent(
      {
        actorAccountId: props.command.session.accountId,
        actorEmployeeId: props.command.session.employeeId,
        action:
          props.action.kind === "corrected"
            ? "employee.lifecycle.corrected"
            : "employee.lifecycle.applied",
        target: { type: "employee", id: String(props.action.employeeId) },
        outcome: "succeeded",
        reasonCode: null,
        authorization: { permission: "employee:lifecycle:apply" },
        before: toSafeAuditState(
          before,
          props.revisions.employeeRevision,
          props.revisions.organizationRevision,
        ),
        after: toSafeAuditState(after, nextEmployeeRevision, nextOrganizationRevision),
        metadata: { actionKind: props.action.kind, effectiveOn: props.action.eventOn },
        now: new Date(props.action.recordedAt * 1_000),
      },
      this.c.var.auditContext,
    )
    const statements: Array<D1PreparedStatement> = [
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
    ]

    if (props.projection.affectsOrganization) {
      statements.push(
        db
          .prepare(
            `UPDATE organization_lifecycle_state
             SET revision = revision + 1, updated_at = ?1
             WHERE id = 1 AND revision = ?2`,
          )
          .bind(props.action.recordedAt, props.revisions.organizationRevision),
        abortWhenPreviousStatementChangedNoRows(db),
      )
    }

    statements.push(
      db
        .prepare(
          `INSERT INTO personnel_actions
             (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
              requested_by_employee_id, source_type, source_application_id,
              corrects_action_id, operation_id, payload_fingerprint, summary_json)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'direct', NULL, ?8, ?9, ?10, ?11)`,
        )
        .bind(
          props.action.id,
          props.action.employeeId,
          props.action.kind,
          props.action.eventOn,
          props.action.recordedAt,
          props.action.recordedByAccountId,
          props.action.requestedByEmployeeId,
          props.action.correctsActionId,
          props.action.operationId,
          props.action.payloadFingerprint,
          stableJson(props.action.summary),
        ),
      abortWhenPreviousStatementChangedNoRows(db),
      ...props.projection.mutations.map((mutation) => mutationStatement(db, mutation)),
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
            `INSERT INTO lifecycle_outbox
               (personnel_action_id, effect_type, payload_json, attempt_count,
                next_attempt_at, processed_at, last_error_code, created_at)
             VALUES (?1, ?2, ?3, 0, ?4, NULL, NULL, ?4)`,
          )
          .bind(
            props.action.id,
            props.action.kind,
            stableJson({ actionId: props.action.id, employeeId: props.action.employeeId }),
            props.action.recordedAt,
          ),
      )
    }

    statements.push(...new AuditEventRepository(this.c).prepareAppend(audit))

    try {
      const results = await db.batch(statements)

      if (results.length !== statements.length || results.some((result) => !result.success)) {
        throw new Error("employee lifecycle batch did not succeed")
      }

      return { action: props.action, replayed: false }
    } catch (cause) {
      if (isAbortedByGuard(cause)) {
        return new ConflictError("人事情報が同時に更新されました", "personnel_action_stale")
      }

      const raced = await new PersonnelActionRepository(this.c).findByOperationId(
        props.action.operationId,
      )

      if (!(raced instanceof ApplicationError) && raced !== null) {
        const replay = this.classifyReplay(raced, props.command, props.action.payloadFingerprint)
        return replay
      }

      return unexpected(cause)
    }
  }
}
