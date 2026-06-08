import type { Forbidden } from "@/domain/payroll/payroll-access"
import { canManagePayroll } from "@/domain/payroll/payroll-access"
import { Payslip } from "@/domain/payroll/payslip"
import { toNetPay } from "@/domain/payroll/to-net-pay"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { PayslipRepository } from "@/infrastructure/payroll/payslip-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"

export type Command = {
  viewerRole: string
  employeeCode: string
  period: string
  baseSalary: number
  allowances: number
  deductions: number
  issuedAt: string
}

export type EmployeeNotFound = { reason: "employee_not_found" }

export type DuplicatePeriod = { reason: "duplicate_period" }

/**
 * 特権ロールが対象社員の給与明細を差引支給額込みで発行する。
 */
export class IssuePayslip {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Payslip | Forbidden | EmployeeNotFound | DuplicatePeriod | Error> {
    if (canManagePayroll(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const employeeRepository = new EmployeeRepository(this.c)

    const payslipRepository = new PayslipRepository(this.c)

    const employee = await employeeRepository.findByCode(command.employeeCode)

    if (employee instanceof Error) {
      return employee
    }

    if (employee === null) {
      return { reason: "employee_not_found" }
    }

    const existing = await payslipRepository.findByEmployeeAndPeriod(employee.id, command.period)

    if (existing instanceof Error) {
      return existing
    }

    if (existing !== null) {
      return { reason: "duplicate_period" }
    }

    const netPay = toNetPay({
      baseSalary: command.baseSalary,
      allowances: command.allowances,
      deductions: command.deductions,
    })

    const payslip = Payslip.create({
      employeeId: employee.id,
      period: command.period,
      baseSalary: command.baseSalary,
      allowances: command.allowances,
      deductions: command.deductions,
      netPay,
      issuedAt: command.issuedAt,
    })

    const created = await payslipRepository.create(payslip)

    if (created instanceof UniqueConstraintError) {
      // 競合（TOCTOU）で UNIQUE 索引に弾かれた = 同一期間が既に在る。再読込に依存せず重複を返す。
      return { reason: "duplicate_period" }
    }

    if (created instanceof Error) {
      return created
    }

    return created
  }
}
