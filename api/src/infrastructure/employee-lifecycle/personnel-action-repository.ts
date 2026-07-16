import type {
  EmployeeStatusPeriod,
  EmploymentPeriod,
  LifecycleVersionMutation,
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
} from "@/domain/employee-lifecycle/lifecycle-schedule"
import {
  personnelActionSummarySchema,
  type PersonnelActionSummary,
} from "@/domain/employee-lifecycle/project-personnel-action"
import type { PersonnelActionKind } from "@/domain/employee-lifecycle/lifecycle-types"
import type { Context } from "@/env"
import { ApplicationError, UnexpectedError } from "@/lib/errors"

export type PersonnelActionRecord = {
  id: string
  employeeId: number
  kind: PersonnelActionKind
  eventOn: string
  recordedAt: number
  recordedByAccountId: number | null
  requestedByEmployeeId: number | null
  sourceType: "application" | "direct" | "migration" | "system"
  sourceApplicationId: number | null
  correctsActionId: string | null
  operationId: string
  payloadFingerprint: string
  summary: PersonnelActionSummary
}

export type PersonnelActionListRecord = PersonnelActionRecord & {
  rowId: number
  corrected: boolean
}

type PersonnelActionRow = {
  id: string
  employee_id: number
  kind: PersonnelActionKind
  event_on: string
  recorded_at: number
  recorded_by_account_id: number | null
  requested_by_employee_id: number | null
  source_type: PersonnelActionRecord["sourceType"]
  source_application_id: number | null
  corrects_action_id: string | null
  operation_id: string
  payload_fingerprint: string
  summary_json: string
}

type PersonnelActionListRow = PersonnelActionRow & {
  action_row_id: number
  is_corrected: number
}

type BaseVersionRow = {
  period_id: string
  revision: number
  starts_on: string
  ends_on: string | null
  is_void: number
  recorded_by_action_id: string
  recorded_at: number
}

type EmploymentVersionRow = BaseVersionRow & { employee_id: number }
type StatusVersionRow = EmploymentVersionRow & {
  employment_period_id: string
  status: "active" | "leave"
}
type AssignmentVersionRow = EmploymentVersionRow & {
  employment_period_id: string
  department_code: string
  assignment_type: "primary" | "concurrent"
  position_title: string | null
  manager_employee_id: number | null
}
type ResponsibilityVersionRow = BaseVersionRow & {
  department_code: string
  responsibility_type: "department_manager"
  employee_id: number
}

function repositoryError(cause: unknown): ApplicationError {
  return new UnexpectedError("人事発令の読み取りに失敗しました", { cause })
}

function toAction(row: PersonnelActionRow): PersonnelActionRecord | ApplicationError {
  try {
    return {
      id: row.id,
      employeeId: row.employee_id,
      kind: row.kind,
      eventOn: row.event_on,
      recordedAt: row.recorded_at,
      recordedByAccountId: row.recorded_by_account_id,
      requestedByEmployeeId: row.requested_by_employee_id,
      sourceType: row.source_type,
      sourceApplicationId: row.source_application_id,
      correctsActionId: row.corrects_action_id,
      operationId: row.operation_id,
      payloadFingerprint: row.payload_fingerprint,
      summary: personnelActionSummarySchema.parse(JSON.parse(row.summary_json)),
    }
  } catch (cause) {
    return repositoryError(cause)
  }
}

function base(row: BaseVersionRow) {
  return {
    periodId: row.period_id,
    revision: row.revision,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isVoid: row.is_void === 1,
    recordedByActionId: row.recorded_by_action_id,
    recordedAt: row.recorded_at,
  }
}

function employment(row: EmploymentVersionRow): EmploymentPeriod {
  return { ...base(row), employeeId: row.employee_id }
}

function status(row: StatusVersionRow): EmployeeStatusPeriod {
  return {
    ...employment(row),
    employmentPeriodId: row.employment_period_id,
    status: row.status,
  }
}

function assignment(row: AssignmentVersionRow): OrgAssignmentPeriod {
  return {
    ...employment(row),
    employmentPeriodId: row.employment_period_id,
    departmentCode: row.department_code,
    assignmentType: row.assignment_type,
    positionTitle: row.position_title,
    managerEmployeeId: row.manager_employee_id,
  }
}

function responsibility(row: ResponsibilityVersionRow): OrgResponsibilityPeriod {
  return {
    ...base(row),
    departmentCode: row.department_code,
    responsibilityType: row.responsibility_type,
    employeeId: row.employee_id,
  }
}

function mutationsFromRows<Row extends BaseVersionRow, Period>(props: {
  rows: ReadonlyArray<Row>
  actionId: string
  periodType: LifecycleVersionMutation["periodType"]
  convert: (row: Row) => Period
}): ReadonlyArray<LifecycleVersionMutation> {
  const byKey = new Map(props.rows.map((row) => [`${row.period_id}:${row.revision}`, row]))

  return props.rows
    .filter((row) => row.recorded_by_action_id === props.actionId)
    .map((row) => ({
      periodType: props.periodType,
      before:
        row.revision === 1
          ? null
          : props.convert(byKey.get(`${row.period_id}:${row.revision - 1}`) as Row),
      after: props.convert(row),
    })) as ReadonlyArray<LifecycleVersionMutation>
}

const actionColumns = `
  id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
  requested_by_employee_id, source_type, source_application_id, corrects_action_id,
  operation_id, payload_fingerprint, summary_json`

export class PersonnelActionRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findByOperationId(
    operationId: string,
  ): Promise<PersonnelActionRecord | null | ApplicationError> {
    return this.findWhere("operation_id", operationId)
  }

  async findById(id: string): Promise<PersonnelActionRecord | null | ApplicationError> {
    return this.findWhere("id", id)
  }

  async maxRowIdForEmployee(props: {
    employeeId: number
    from: string | null
    to: string | null
  }): Promise<number | ApplicationError> {
    try {
      return (
        (await this.c.env.DB.prepare(
          `SELECT COALESCE(MAX(rowid), 0) AS max_row_id
             FROM personnel_actions
             WHERE employee_id = ?1
               AND (?2 IS NULL OR event_on >= ?2)
               AND (?3 IS NULL OR event_on <= ?3)`,
        )
          .bind(props.employeeId, props.from, props.to)
          .first<number>("max_row_id")) ?? 0
      )
    } catch (cause) {
      return repositoryError(cause)
    }
  }

  async listForEmployee(props: {
    employeeId: number
    from: string | null
    to: string | null
    anchorRowId: number
    position: { eventOn: string; recordedAt: number; id: string } | null
    limit: number
  }): Promise<ReadonlyArray<PersonnelActionListRecord> | ApplicationError> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT action.rowid AS action_row_id, ${actionColumns
          .split(",")
          .map((column) => `action.${column.trim()}`)
          .join(", ")},
                EXISTS (
                  SELECT 1 FROM personnel_actions AS correction
                  WHERE correction.corrects_action_id = action.id
                    AND correction.rowid <= ?4
                ) AS is_corrected
           FROM personnel_actions AS action
           WHERE action.employee_id = ?1
             AND (?2 IS NULL OR action.event_on >= ?2)
             AND (?3 IS NULL OR action.event_on <= ?3)
             AND action.rowid <= ?4
             AND (
               ?5 IS NULL
               OR action.event_on < ?5
               OR (action.event_on = ?5 AND action.recorded_at < ?6)
               OR (action.event_on = ?5 AND action.recorded_at = ?6 AND action.id < ?7)
             )
           ORDER BY action.event_on DESC, action.recorded_at DESC, action.id DESC
           LIMIT ?8`,
      )
        .bind(
          props.employeeId,
          props.from,
          props.to,
          props.anchorRowId,
          props.position?.eventOn ?? null,
          props.position?.recordedAt ?? null,
          props.position?.id ?? null,
          props.limit,
        )
        .all<PersonnelActionListRow>()
      const result: Array<PersonnelActionListRecord> = []
      for (const row of rows.results) {
        const action = toAction(row)
        if (action instanceof ApplicationError) return action
        result.push({ ...action, rowId: row.action_row_id, corrected: row.is_corrected === 1 })
      }
      return result
    } catch (cause) {
      return repositoryError(cause)
    }
  }

  private async findWhere(
    column: "id" | "operation_id",
    value: string,
  ): Promise<PersonnelActionRecord | null | ApplicationError> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT ${actionColumns} FROM personnel_actions WHERE ${column} = ?1`,
      )
        .bind(value)
        .first<PersonnelActionRow>()

      return row === null ? null : toAction(row)
    } catch (cause) {
      return repositoryError(cause)
    }
  }

  async hasCorrection(actionId: string): Promise<boolean | ApplicationError> {
    try {
      return (
        ((await this.c.env.DB.prepare(
          "SELECT COUNT(*) AS count FROM personnel_actions WHERE corrects_action_id = ?1",
        )
          .bind(actionId)
          .first<number>("count")) ?? 0) > 0
      )
    } catch (cause) {
      return repositoryError(cause)
    }
  }

  async loadMutationsForAction(
    actionId: string,
  ): Promise<ReadonlyArray<LifecycleVersionMutation> | ApplicationError> {
    try {
      const db = this.c.env.DB
      const [employmentRows, statusRows, assignmentRows, responsibilityRows] = await Promise.all([
        db
          .prepare(
            `SELECT period_id, revision, employee_id, starts_on, ends_on, is_void,
                    recorded_by_action_id, recorded_at
             FROM employment_period_versions
             WHERE period_id IN (
               SELECT period_id FROM employment_period_versions WHERE recorded_by_action_id = ?1
             ) ORDER BY period_id, revision`,
          )
          .bind(actionId)
          .all<EmploymentVersionRow>(),
        db
          .prepare(
            `SELECT period_id, revision, employment_period_id, employee_id, status,
                    starts_on, ends_on, is_void, recorded_by_action_id, recorded_at
             FROM employee_status_period_versions
             WHERE period_id IN (
               SELECT period_id FROM employee_status_period_versions WHERE recorded_by_action_id = ?1
             ) ORDER BY period_id, revision`,
          )
          .bind(actionId)
          .all<StatusVersionRow>(),
        db
          .prepare(
            `SELECT period_id, revision, employment_period_id, employee_id, department_code,
                    assignment_type, position_title, manager_employee_id, starts_on, ends_on,
                    is_void, recorded_by_action_id, recorded_at
             FROM org_assignment_period_versions
             WHERE period_id IN (
               SELECT period_id FROM org_assignment_period_versions WHERE recorded_by_action_id = ?1
             ) ORDER BY period_id, revision`,
          )
          .bind(actionId)
          .all<AssignmentVersionRow>(),
        db
          .prepare(
            `SELECT period_id, revision, department_code, responsibility_type, employee_id,
                    starts_on, ends_on, is_void, recorded_by_action_id, recorded_at
             FROM org_responsibility_period_versions
             WHERE period_id IN (
               SELECT period_id FROM org_responsibility_period_versions WHERE recorded_by_action_id = ?1
             ) ORDER BY period_id, revision`,
          )
          .bind(actionId)
          .all<ResponsibilityVersionRow>(),
      ])

      return [
        ...mutationsFromRows({
          rows: employmentRows.results,
          actionId,
          periodType: "employment",
          convert: employment,
        }),
        ...mutationsFromRows({
          rows: statusRows.results,
          actionId,
          periodType: "status",
          convert: status,
        }),
        ...mutationsFromRows({
          rows: assignmentRows.results,
          actionId,
          periodType: "assignment",
          convert: assignment,
        }),
        ...mutationsFromRows({
          rows: responsibilityRows.results,
          actionId,
          periodType: "responsibility",
          convert: responsibility,
        }),
      ]
    } catch (cause) {
      return repositoryError(cause)
    }
  }
}
