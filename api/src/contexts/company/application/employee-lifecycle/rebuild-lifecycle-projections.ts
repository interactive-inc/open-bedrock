import { createAuditEvent } from "@/composition/audit/audit-event"
import { containsDate } from "@/contexts/company/domain/employee-lifecycle/contains-date"
import type { LifecycleSchedule } from "@/contexts/company/domain/employee-lifecycle/lifecycle-schedule"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/contexts/company/infrastructure/company/audit/audit-event-repository"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { ApplicationError, UnavailableError, UnexpectedError } from "@/lib/errors"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"

type EmployeeProjectionRow = {
  id: number
  code: string
  dept_id: number | null
  dept_name: string | null
  position: string | null
  status: "active" | "leave" | "retired"
}

type MembershipRow = {
  department_code: string
  employee_code: string
  manager_employee_code: string | null
}

function scheduleEmployeeId(schedule: LifecycleSchedule): number | undefined {
  return [
    ...schedule.employments,
    ...schedule.statuses,
    ...schedule.assignments,
    ...schedule.responsibilities,
  ][0]?.employeeId
}

function membershipKey(row: MembershipRow): string {
  return `${row.department_code}\u0000${row.employee_code}\u0000${row.manager_employee_code ?? ""}`
}

export class RebuildLifecycleProjections {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(): Promise<
    | { businessDate: string; employeesChanged: number; membershipsChanged: number }
    | ApplicationError
  > {
    const lifecycleRepository = new EmployeeLifecycleRepository(this.c)
    const migrationStatus = await lifecycleRepository.migrationStatus()
    if (migrationStatus instanceof ApplicationError) return migrationStatus
    if (migrationStatus !== "verified") {
      return new UnavailableError(
        "人事ライフサイクル移行が完了していません",
        "lifecycle_migration_incomplete",
      )
    }

    const nowIso = this.c.env.NOW ?? new Date().toISOString()
    const businessDate = resolveCompanyBusinessDate({
      now: nowIso,
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (typeof businessDate !== "string") {
      return new UnavailableError("会社営業日を解決できません", "company_timezone_unavailable", {
        cause: businessDate,
      })
    }

    try {
      const [schedules, references, employeeRows, departmentRows, membershipRows] =
        await Promise.all([
          lifecycleRepository.loadOrganizationSchedules(),
          lifecycleRepository.loadReferences(),
          this.c.env.DB.prepare(
            `SELECT id, code, dept_id, dept_name, position, status FROM employees ORDER BY id`,
          ).all<EmployeeProjectionRow>(),
          this.c.env.DB.prepare(
            `SELECT organization.code, organization.department_id, department.name
               FROM org_departments AS organization
               INNER JOIN departments AS department ON department.id = organization.department_id`,
          ).all<{ code: string; department_id: number; name: string }>(),
          this.c.env.DB.prepare(
            `SELECT department_code, employee_code, manager_employee_code
               FROM org_memberships ORDER BY department_code, employee_code`,
          ).all<MembershipRow>(),
        ])
      if (schedules instanceof ApplicationError) return schedules
      if (references instanceof ApplicationError) return references

      const scheduleByEmployee = new Map(
        schedules
          .map((schedule) => [scheduleEmployeeId(schedule), schedule] as const)
          .filter((entry): entry is readonly [number, LifecycleSchedule] => entry[0] !== undefined),
      )
      const departmentByCode = new Map(departmentRows.results.map((row) => [row.code, row]))
      const employeeCodeById = new Map(references.employees.map((row) => [row.id, row.code]))
      const desiredEmployees = employeeRows.results.map((employee) => {
        const schedule = scheduleByEmployee.get(employee.id)
        const employment = schedule?.employments.find((period) =>
          containsDate(period, businessDate),
        )
        const status = schedule?.statuses.find(
          (period) =>
            period.employmentPeriodId === employment?.periodId &&
            containsDate(period, businessDate),
        )
        const primary = schedule?.assignments.find(
          (period) =>
            period.employmentPeriodId === employment?.periodId &&
            period.assignmentType === "primary" &&
            containsDate(period, businessDate),
        )
        const department =
          primary === undefined ? undefined : departmentByCode.get(primary.departmentCode)
        return {
          current: employee,
          desired: {
            deptId: department?.department_id ?? null,
            deptName: department?.name ?? null,
            position: primary?.positionTitle ?? null,
            status: status?.status ?? "retired",
          },
        }
      })
      const changedEmployees = desiredEmployees.filter(
        ({ current, desired }) =>
          current.dept_id !== desired.deptId ||
          current.dept_name !== desired.deptName ||
          current.position !== desired.position ||
          current.status !== desired.status,
      )
      const desiredMemberships: MembershipRow[] = []
      for (const [employeeId, schedule] of scheduleByEmployee) {
        const code = employeeCodeById.get(employeeId)
        if (code === undefined) continue
        for (const assignment of schedule.assignments.filter((period) =>
          containsDate(period, businessDate),
        )) {
          desiredMemberships.push({
            department_code: assignment.departmentCode,
            employee_code: code,
            manager_employee_code:
              assignment.managerEmployeeId === null
                ? null
                : (employeeCodeById.get(assignment.managerEmployeeId) ?? null),
          })
        }
      }
      const existingKeys = new Set(membershipRows.results.map(membershipKey))
      const desiredKeys = new Set(desiredMemberships.map(membershipKey))
      const membershipsChanged =
        [...existingKeys].filter((key) => !desiredKeys.has(key)).length +
        [...desiredKeys].filter((key) => !existingKeys.has(key)).length
      const affectedEmployeeCodes = new Set<string>()
      for (const row of membershipRows.results) {
        if (!desiredKeys.has(membershipKey(row))) affectedEmployeeCodes.add(row.employee_code)
      }
      for (const row of desiredMemberships) {
        if (!existingKeys.has(membershipKey(row))) affectedEmployeeCodes.add(row.employee_code)
      }

      const statements: D1PreparedStatement[] = changedEmployees.map(({ current, desired }) =>
        this.c.env.DB.prepare(
          `UPDATE employees SET dept_id = ?1, dept_name = ?2, position = ?3, status = ?4
             WHERE id = ?5`,
        ).bind(desired.deptId, desired.deptName, desired.position, desired.status, current.id),
      )
      for (const code of affectedEmployeeCodes) {
        statements.push(
          this.c.env.DB.prepare("DELETE FROM org_memberships WHERE employee_code = ?1").bind(code),
          ...desiredMemberships
            .filter((membership) => membership.employee_code === code)
            .map((membership) =>
              this.c.env.DB.prepare(
                `INSERT INTO org_memberships
                     (department_code, employee_code, manager_employee_code)
                   VALUES (?1, ?2, ?3)`,
              ).bind(
                membership.department_code,
                membership.employee_code,
                membership.manager_employee_code,
              ),
            ),
        )
      }

      const session = this.c.var.session
      const now = new Date(nowIso)
      const audit = createAuditEvent(
        {
          actorAccountId: session?.accountId ?? null,
          actorEmployeeId: session?.employeeId ?? null,
          action: "employee.lifecycle.projections_rebuilt",
          target: { type: "employee", id: null },
          outcome: "succeeded",
          reasonCode: null,
          metadata: {
            businessDate,
            employeesChanged: changedEmployees.length,
            membershipsChanged,
          },
          now,
        },
        this.c.var.auditContext,
      )
      statements.push(...new AuditEventRepository(this.c).prepareAppend(audit))
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        throw new Error("projection rebuild batch did not succeed")
      }

      return {
        businessDate,
        employeesChanged: changedEmployees.length,
        membershipsChanged,
      }
    } catch (cause) {
      return new UnexpectedError("人事ライフサイクル投影の再構築に失敗しました", { cause })
    }
  }
}
