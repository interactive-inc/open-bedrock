import {
  loadLegacyLifecycleSnapshot,
  type LegacyLifecycleSnapshot,
} from "@/application/employee-lifecycle/load-legacy-lifecycle-snapshot"
import { validateMigrationInput } from "@/application/employee-lifecycle/validate-migration-input"
import { containsDate } from "@/contexts/company/domain/employee-lifecycle/contains-date"
import type { LifecycleSchedule } from "@/contexts/company/domain/employee-lifecycle/lifecycle-schedule"
import { validateLifecycleSchedules } from "@/contexts/company/domain/employee-lifecycle/validate-lifecycle-schedule"
import type { Context } from "@/env"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { ApplicationError, ConflictError, UnexpectedError } from "@/lib/errors"

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
  employee_count: number
  department_count: number
}

function scheduleForEmployee(
  schedules: ReadonlyArray<LifecycleSchedule>,
  employeeId: number,
): LifecycleSchedule {
  return (
    schedules.find((schedule) =>
      [
        ...schedule.employments,
        ...schedule.statuses,
        ...schedule.assignments,
        ...schedule.responsibilities,
      ].some((period) => period.employeeId === employeeId),
    ) ?? { employments: [], statuses: [], assignments: [], responsibilities: [] }
  )
}

function projectionMatches(
  snapshot: LegacyLifecycleSnapshot,
  schedules: ReadonlyArray<LifecycleSchedule>,
  baselineOn: string,
): boolean {
  for (const employee of snapshot.employees) {
    const schedule = scheduleForEmployee(schedules, employee.id)
    const employment = schedule.employments.find((period) => containsDate(period, baselineOn))

    if (employee.status === "retired") {
      if (employment !== undefined) return false
      continue
    }

    if (employment === undefined) return false
    const status = schedule.statuses.find(
      (period) =>
        period.employmentPeriodId === employment.periodId && containsDate(period, baselineOn),
    )
    if (status?.status !== employee.status) return false

    const primary = schedule.assignments.find(
      (period) =>
        period.employmentPeriodId === employment.periodId &&
        period.assignmentType === "primary" &&
        containsDate(period, baselineOn),
    )
    const expectedDepartment = snapshot.departments.find(
      (department) => department.departmentId === employee.deptId,
    )
    if ((primary?.departmentCode ?? null) !== (expectedDepartment?.code ?? null)) return false
    if ((primary?.positionTitle ?? null) !== employee.position) return false
    if ((expectedDepartment?.name ?? null) !== employee.deptName) return false

    const employeeMemberships = snapshot.memberships.filter(
      (membership) => membership.employeeCode === employee.code,
    )
    const primaryMembership = employeeMemberships.find(
      (membership) => membership.departmentCode === expectedDepartment?.code,
    )
    const expectedAssignments = [
      ...(expectedDepartment === undefined
        ? []
        : [`${expectedDepartment.code}:${primaryMembership?.managerEmployeeCode ?? ""}`]),
      ...employeeMemberships
        .filter((membership) => membership.departmentCode !== expectedDepartment?.code)
        .map(
          (membership) => `${membership.departmentCode}:${membership.managerEmployeeCode ?? ""}`,
        ),
    ].sort()
    const actualAssignments = schedule.assignments
      .filter((assignment) => containsDate(assignment, baselineOn))
      .map((assignment) => {
        const managerCode =
          assignment.managerEmployeeId === null
            ? null
            : (snapshot.employees.find((candidate) => candidate.id === assignment.managerEmployeeId)
                ?.code ?? null)
        return `${assignment.departmentCode}:${managerCode ?? ""}`
      })
      .sort()
    if (JSON.stringify(expectedAssignments) !== JSON.stringify(actualAssignments)) return false
  }

  return true
}

export class VerifyLifecycleMigration {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(
    command: MigrationCommand,
  ): Promise<{ status: "verified"; employeesVerified: number } | ApplicationError> {
    const inputError = validateMigrationInput(this.c, command)
    if (inputError !== undefined) return inputError

    try {
      const state = await this.c.env.DB.prepare(
        `SELECT status, baseline_on, company_time_zone, legacy_source_fingerprint,
                  employee_count, department_count
           FROM lifecycle_migration_states WHERE id = 1`,
      ).first<MigrationState>()
      if (
        state === null ||
        state.status === "pending" ||
        state.baseline_on !== command.baselineOn ||
        state.company_time_zone !== command.timeZone ||
        state.legacy_source_fingerprint !== command.legacySourceFingerprint
      ) {
        return new ConflictError("backfill 済みの移行条件と一致しません", "personnel_action_stale")
      }
      if (state.status === "verified") {
        return { status: "verified", employeesVerified: state.employee_count }
      }

      const snapshot = await loadLegacyLifecycleSnapshot(this.c)
      if (snapshot instanceof ApplicationError) return snapshot
      const schedules = await new EmployeeLifecycleRepository(this.c).loadOrganizationSchedules()
      if (schedules instanceof ApplicationError) return schedules

      if (!projectionMatches(snapshot, schedules, command.baselineOn)) {
        return new ConflictError(
          "旧投影と人事ライフサイクル正本が一致しません",
          "lifecycle_projection_mismatch",
        )
      }
      if (
        snapshot.fingerprint !== command.legacySourceFingerprint ||
        snapshot.employees.length !== state.employee_count ||
        snapshot.departments.length !== state.department_count ||
        snapshot.issues.length > 0
      ) {
        return new ConflictError("backfill 後に旧データが変更されました", "personnel_action_stale")
      }

      const validationError = validateLifecycleSchedules({
        schedules,
        departments: snapshot.departments.map((department) => department.code),
      })
      if (validationError !== undefined) return validationError

      const baselineCount =
        (await this.c.env.DB.prepare(
          "SELECT COUNT(*) AS count FROM personnel_actions WHERE kind = 'legacy_baseline'",
        ).first<number>("count")) ?? 0
      if (baselineCount !== snapshot.employees.length) {
        return new ConflictError("移行基準発令が不足しています", "lifecycle_migration_incomplete")
      }

      const now = Math.floor(Date.parse(this.c.env.NOW ?? new Date().toISOString()) / 1_000)
      const update = await this.c.env.DB.prepare(
        `UPDATE lifecycle_migration_states SET status = 'verified', verified_at = ?1
           WHERE id = 1 AND status = 'backfilled' AND legacy_source_fingerprint = ?2`,
      )
        .bind(now, command.legacySourceFingerprint)
        .run()
      if ((update.meta.changes ?? 0) !== 1) {
        return new ConflictError("移行状態が同時に変更されました", "personnel_action_stale")
      }

      return { status: "verified", employeesVerified: snapshot.employees.length }
    } catch (cause) {
      return new UnexpectedError("従業員ライフサイクルの検証に失敗しました", { cause })
    }
  }
}
