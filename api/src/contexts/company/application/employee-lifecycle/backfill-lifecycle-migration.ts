import { lifecycleSha256 } from "@/contexts/company/application/employee-lifecycle/lifecycle-sha256"
import {
  loadLegacyLifecycleSnapshot,
  type LegacyLifecycleSnapshot,
} from "@/contexts/company/application/employee-lifecycle/load-legacy-lifecycle-snapshot"
import { stableLifecycleJson } from "@/contexts/company/application/employee-lifecycle/stable-lifecycle-json"
import { validateMigrationInput } from "@/contexts/company/application/employee-lifecycle/validate-migration-input"
import { personnelActionSummarySchema } from "@/contexts/company/domain/employee-lifecycle/project-personnel-action"
import type { Context } from "@/env"
import { ApplicationError, ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"

type MigrationCommand = {
  baselineOn: string
  timeZone: string
  legacySourceFingerprint: string
}

type MigrationState = {
  status: "pending" | "backfilled" | "verified"
  baseline_on: string | null
  company_time_zone: string | null
  legacy_source_fingerprint: string | null
}

function actionId(snapshot: LegacyLifecycleSnapshot, employeeId: number): string {
  return `legacy:${snapshot.fingerprint}:${employeeId}`
}

function primaryDepartment(snapshot: LegacyLifecycleSnapshot, departmentId: number | null) {
  if (departmentId === null) return null
  return snapshot.departments.find((department) => department.departmentId === departmentId) ?? null
}

export class BackfillLifecycleMigration {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(
    command: MigrationCommand,
  ): Promise<
    { employeesBackfilled: number; status: "backfilled" | "verified" } | ApplicationError
  > {
    const inputError = validateMigrationInput(this.c, command)
    if (inputError !== undefined) return inputError

    const snapshot = await loadLegacyLifecycleSnapshot(this.c)
    if (snapshot instanceof ApplicationError) return snapshot
    if (snapshot.issues.length > 0) {
      return new ConflictError(
        "旧データに解消が必要な不整合があります",
        "lifecycle_migration_incomplete",
      )
    }
    if (snapshot.fingerprint !== command.legacySourceFingerprint) {
      return new ConflictError("preflight 後に旧データが変更されました", "personnel_action_stale")
    }

    try {
      const state = await this.c.env.DB.prepare(
        `SELECT status, baseline_on, company_time_zone, legacy_source_fingerprint
           FROM lifecycle_migration_states WHERE id = 1`,
      ).first<MigrationState>()
      if (state === null) {
        return new UnexpectedError("移行状態が見つかりません")
      }
      if (
        state.baseline_on !== null &&
        (state.baseline_on !== command.baselineOn ||
          state.company_time_zone !== command.timeZone ||
          state.legacy_source_fingerprint !== command.legacySourceFingerprint)
      ) {
        return new ConflictError("開始済みの移行条件と一致しません", "personnel_action_stale")
      }
      if (state.status === "verified") {
        return { employeesBackfilled: snapshot.employees.length, status: "verified" }
      }

      const employeeIds = new Map(
        snapshot.employees.map((employee) => [employee.code, employee.id]),
      )
      const now = Math.floor(Date.parse(this.c.env.NOW ?? new Date().toISOString()) / 1_000)

      for (const employee of snapshot.employees) {
        const id = actionId(snapshot, employee.id)
        const operationId = `legacy-baseline:${snapshot.fingerprint}:${employee.id}`
        const primary = primaryDepartment(snapshot, employee.deptId)
        const employeeMemberships = snapshot.memberships.filter(
          (membership) => membership.employeeCode === employee.code,
        )
        const primaryMembership = employeeMemberships.find(
          (membership) => membership.departmentCode === primary?.code,
        )
        const fingerprint = await lifecycleSha256(
          stableLifecycleJson({ employee, memberships: employeeMemberships }),
        )
        const summary = personnelActionSummarySchema.parse({
          kind: "legacy_baseline",
          eventOn: command.baselineOn,
          department: primary === null ? null : { code: primary.code, name: primary.name },
          positionTitle: employee.position,
          managerEmployeeCode: primaryMembership?.managerEmployeeCode ?? null,
          status: employee.status,
        })
        const statements: Array<D1PreparedStatement> = [
          this.c.env.DB.prepare(
            `INSERT OR IGNORE INTO personnel_actions
                 (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
                  requested_by_employee_id, source_type, source_application_id,
                  corrects_action_id, operation_id, payload_fingerprint, summary_json)
               VALUES (?1, ?2, 'legacy_baseline', ?3, ?4, NULL, NULL, 'migration',
                       NULL, NULL, ?5, ?6, ?7)`,
          ).bind(
            id,
            employee.id,
            command.baselineOn,
            now,
            operationId,
            fingerprint,
            stableLifecycleJson(summary),
          ),
          this.c.env.DB.prepare(
            `INSERT OR IGNORE INTO employee_lifecycle_revisions
                 (employee_id, revision, updated_at) VALUES (?1, 0, ?2)`,
          ).bind(employee.id, now),
        ]

        if (employee.status !== "retired") {
          const employmentId = `${id}:employment:1`
          statements.push(
            this.c.env.DB.prepare(
              `INSERT OR IGNORE INTO employment_period_versions
                   (period_id, revision, employee_id, starts_on, ends_on, is_void,
                    recorded_by_action_id, recorded_at)
                 VALUES (?1, 1, ?2, ?3, NULL, 0, ?4, ?5)`,
            ).bind(employmentId, employee.id, command.baselineOn, id, now),
            this.c.env.DB.prepare(
              `INSERT OR IGNORE INTO employee_status_period_versions
                   (period_id, revision, employment_period_id, employee_id, status,
                    starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
                 VALUES (?1, 1, ?2, ?3, ?4, ?5, NULL, 0, ?6, ?7)`,
            ).bind(
              `${id}:status:1`,
              employmentId,
              employee.id,
              employee.status,
              command.baselineOn,
              id,
              now,
            ),
          )
        }

        const results = await this.c.env.DB.batch(statements)
        if (results.length !== statements.length || results.some((result) => !result.success)) {
          throw new Error("legacy employee backfill did not succeed")
        }
      }

      for (const employee of snapshot.employees) {
        if (employee.status === "retired") continue

        const id = actionId(snapshot, employee.id)
        const employmentId = `${id}:employment:1`
        const primary = primaryDepartment(snapshot, employee.deptId)
        const employeeMemberships = snapshot.memberships.filter(
          (membership) => membership.employeeCode === employee.code,
        )
        const primaryMembership = employeeMemberships.find(
          (membership) => membership.departmentCode === primary?.code,
        )
        const assignments = [
          ...(primary === null
            ? []
            : [
                {
                  departmentCode: primary.code,
                  assignmentType: "primary" as const,
                  positionTitle: employee.position,
                  managerEmployeeCode: primaryMembership?.managerEmployeeCode ?? null,
                },
              ]),
          ...employeeMemberships
            .filter((membership) => membership.departmentCode !== primary?.code)
            .map((membership) => ({
              departmentCode: membership.departmentCode,
              assignmentType: "concurrent" as const,
              positionTitle: null,
              managerEmployeeCode: membership.managerEmployeeCode,
            })),
        ]
        const statements: Array<D1PreparedStatement> = []

        for (const [index, assignment] of assignments.entries()) {
          statements.push(
            this.c.env.DB.prepare(
              `INSERT OR IGNORE INTO employee_org_assignment_period_versions
                   (period_id, revision, employment_period_id, employee_id, department_code,
                    assignment_type, position_title, manager_employee_id, starts_on, ends_on,
                    is_void, recorded_by_action_id, recorded_at)
                 VALUES (?1, 1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, 0, ?9, ?10)`,
            ).bind(
              `${id}:assignment:${index + 1}`,
              employmentId,
              employee.id,
              assignment.departmentCode,
              assignment.assignmentType,
              assignment.positionTitle,
              assignment.managerEmployeeCode === null
                ? null
                : (employeeIds.get(assignment.managerEmployeeCode) ?? null),
              command.baselineOn,
              id,
              now,
            ),
          )
        }

        const responsibilities = snapshot.departments.filter(
          (department) => department.managerEmployeeCode === employee.code,
        )
        for (const [index, responsibility] of responsibilities.entries()) {
          statements.push(
            this.c.env.DB.prepare(
              `INSERT OR IGNORE INTO employee_org_responsibility_period_versions
                   (period_id, revision, department_code, responsibility_type, employee_id,
                    starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
                 VALUES (?1, 1, ?2, 'department_manager', ?3, ?4, NULL, 0, ?5, ?6)`,
            ).bind(
              `${id}:responsibility:${index + 1}`,
              responsibility.code,
              employee.id,
              command.baselineOn,
              id,
              now,
            ),
          )
        }

        if (statements.length === 0) continue

        const results = await this.c.env.DB.batch(statements)
        if (results.length !== statements.length || results.some((result) => !result.success)) {
          throw new Error("legacy organization backfill did not succeed")
        }
      }

      await this.c.env.DB.prepare(
        `UPDATE lifecycle_migration_states
           SET status = 'backfilled', baseline_on = ?1, company_time_zone = ?2,
               legacy_source_fingerprint = ?3, employee_count = ?4, department_count = ?5,
               backfilled_at = ?6, verified_at = NULL
           WHERE id = 1 AND status IN ('pending', 'backfilled')`,
      )
        .bind(
          command.baselineOn,
          command.timeZone,
          command.legacySourceFingerprint,
          snapshot.employees.length,
          snapshot.departments.length,
          now,
        )
        .run()

      return { employeesBackfilled: snapshot.employees.length, status: "backfilled" }
    } catch (cause) {
      if (cause instanceof ApplicationError) return cause
      if (cause instanceof SyntaxError) {
        return new ValidationError(
          "移行スナップショットが不正です",
          "lifecycle_migration_incomplete",
          {
            cause,
          },
        )
      }
      return new UnexpectedError("従業員ライフサイクルの移行に失敗しました", { cause })
    }
  }
}
