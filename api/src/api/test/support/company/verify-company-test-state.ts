import {
  loadCompanyFixtureSnapshot,
  type CompanyFixtureSnapshot,
} from "@/api/test/support/company/load-company-fixture-snapshot.test-support"
import { validateCompanyInitializationInput } from "@/api/test/support/company/validate-company-initialization-input"
import { containsDate } from "@/contexts/company/domain/definitions/contains-date.definition"
import type { LifecycleSchedule } from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import { validateLifecycleSchedules } from "@/contexts/company/domain/policies/validate-lifecycle-schedule.policy"
import type { Context } from "@/env"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle.repository"
import { ApplicationError, ConflictError, UnexpectedError } from "@/lib/errors"

type CompanyTestVerificationCommand = {
  baselineOn: string
  timeZone: string
  sourceFingerprint: string
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
  snapshot: CompanyFixtureSnapshot,
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
    if (expectedDepartment !== undefined && expectedDepartment.name !== employee.deptName) {
      return false
    }

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

export class VerifyCompanyTestState {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(
    command: CompanyTestVerificationCommand,
  ): Promise<{ employeesVerified: number } | ApplicationError> {
    const inputError = validateCompanyInitializationInput(this.c, command)
    if (inputError !== undefined) return inputError

    try {
      const snapshot = await loadCompanyFixtureSnapshot(this.c)
      if (snapshot instanceof ApplicationError) return snapshot
      const schedules = await new EmployeeLifecycleRepository(this.c).loadOrganizationSchedules()
      if (schedules instanceof Error) return schedules

      if (!projectionMatches(snapshot, schedules, command.baselineOn)) {
        return new ConflictError(
          "Company fixtureとcanonical lifecycleが一致しません",
          "lifecycle_projection_mismatch",
        )
      }
      if (snapshot.fingerprint !== command.sourceFingerprint || snapshot.issues.length > 0) {
        return new ConflictError(
          "Company fixture fingerprintが一致しません",
          "personnel_action_stale",
        )
      }

      const validationError = validateLifecycleSchedules({
        schedules,
        departments: snapshot.departments.map((department) => department.code),
      })
      if (validationError !== undefined) return validationError

      const baselineCount =
        (await this.c.env.DB.prepare(
          "SELECT COUNT(*) AS count FROM personnel_actions WHERE kind = 'initial_state'",
        ).first<number>("count")) ?? 0
      if (baselineCount !== snapshot.employees.length) {
        return new ConflictError(
          "初期状態の人事発令が不足しています",
          "lifecycle_projection_mismatch",
        )
      }

      return { employeesVerified: snapshot.employees.length }
    } catch (cause) {
      return new UnexpectedError("従業員ライフサイクルの検証に失敗しました", { cause })
    }
  }
}
