import type { Forbidden } from "@/lib/payroll/payroll-access"
import { canManagePayroll } from "@/lib/payroll/payroll-access"
import { Payslip } from "@/domain/payroll/payslip.entity"
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

    const netPay = Payslip.toNetPay({
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

    // payslips の UNIQUE 索引は (employee_id, period) のみ。insert の UNIQUE 違反は
    // 同一期間の二重発行と確定できるため、再読込に依存せず重複を返す（TOCTOU 競合対策）。
    // 索引を増やす場合はこの分岐の前提が崩れるので見直すこと。
    if (created instanceof UniqueConstraintError) {
      return { reason: "duplicate_period" }
    }

    // それ以外の DB エラーはそのまま伝播し、ルートで 500 になる。
    return created
  }
}
