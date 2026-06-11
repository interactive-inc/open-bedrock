import type { Forbidden } from "@/domain/payroll/payroll-access"
import { canManagePayroll } from "@/domain/payroll/payroll-access"
import { SalaryRevision } from "@/domain/payroll/salary-revision"
import { toPreviousBaseSalary } from "@/domain/payroll/to-previous-base-salary"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { SalaryRevisionRepository } from "@/infrastructure/payroll/salary-revision-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"

export type Command = {
  viewerRole: string
  employeeCode: string
  effectiveDate: string
  newBaseSalary: number
  reason: string | null
  createdAt: string
}

export type EmployeeNotFound = { reason: "employee_not_found" }

export type DuplicateEffectiveDate = { reason: "duplicate_effective_date" }

/**
 * 特権ロールが前回基本給を解決しつつ給与改定を作成する。
 */
export class CreateSalaryRevision {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<SalaryRevision | Forbidden | EmployeeNotFound | DuplicateEffectiveDate | Error> {
    if (canManagePayroll(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const employeeRepository = new EmployeeRepository(this.c)

    const salaryRevisionRepository = new SalaryRevisionRepository(this.c)

    const employee = await employeeRepository.findByCode(command.employeeCode)

    if (employee instanceof Error) {
      return employee
    }

    if (employee === null) {
      return { reason: "employee_not_found" }
    }

    const priorRevision = await salaryRevisionRepository.findLatestBeforeDate(
      employee.id,
      command.effectiveDate,
    )

    if (priorRevision instanceof Error) {
      return priorRevision
    }

    const salaryRevision = SalaryRevision.create({
      employeeId: employee.id,
      effectiveDate: command.effectiveDate,
      previousBaseSalary: toPreviousBaseSalary({ priorRevision }),
      newBaseSalary: command.newBaseSalary,
      reason: command.reason,
      createdAt: command.createdAt,
    })

    const created = await salaryRevisionRepository.create(salaryRevision)

    if (created instanceof Error && !(created instanceof UniqueConstraintError)) {
      return created
    }

    if (created instanceof UniqueConstraintError) {
      return { reason: "duplicate_effective_date" }
    }

    return created
  }
}
