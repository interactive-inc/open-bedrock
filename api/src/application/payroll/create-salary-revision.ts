import type { Forbidden } from "@/domain/payroll/payroll-access"
import { canManagePayroll } from "@/domain/payroll/payroll-access"
import { SalaryRevision } from "@/domain/payroll/salary-revision"
import { toPreviousBaseSalary } from "@/domain/payroll/to-previous-base-salary"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { SalaryRevisionRepository } from "@/infrastructure/payroll/salary-revision-repository"

export type Command = {
  viewerRole: string
  employeeCode: string
  effectiveDate: string
  newBaseSalary: number
  reason: string | null
  createdAt: string
}

export type EmployeeNotFound = { reason: "employee_not_found" }

/**
 * 特権ロールが前回基本給を解決しつつ給与改定を作成する。
 */
export class CreateSalaryRevision {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<SalaryRevision | Forbidden | EmployeeNotFound | Error> {
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

    const latest = await salaryRevisionRepository.findLatestByEmployeeId(employee.id)

    if (latest instanceof Error) {
      return latest
    }

    const salaryRevision = SalaryRevision.create({
      employeeId: employee.id,
      effectiveDate: command.effectiveDate,
      previousBaseSalary: toPreviousBaseSalary({ latestRevision: latest }),
      newBaseSalary: command.newBaseSalary,
      reason: command.reason,
      createdAt: command.createdAt,
    })

    return await salaryRevisionRepository.create(salaryRevision)
  }
}
